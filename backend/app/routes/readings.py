import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, sessionmaker
from app.database import get_db
from app import crud, models, schemas, intelligence_service, incident_service, conflict_service
from app.websocket_manager import manager
from app.routes.incidents import serialize_incident_for_ui

logger = logging.getLogger("adaptive_fleet.routes.readings")
router = APIRouter(tags=["Telemetry"])

class ManualAnalyzePacket(BaseModel):
    device_id: str
    device_instance_id: Optional[str] = None
    region: Optional[str] = "North"
    temperature: float
    vibration: float
    current: float
    rpm: float
    timestamp: Optional[str] = None

@router.post(
    "/readings",
    response_model=schemas.HealthResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest Canonical Telemetry Reading",
    description="""
    Ingests canonical 4-metric telemetry, executes Member 1 HealthEngine,
    persists telemetry, baseline, and incident state in primary transaction,
    then executes regional conflict evaluation and dispatches WebSocket events.
    """
)
async def post_reading(
    payload: schemas.TelemetryIngestRequest,
    db: Session = Depends(get_db)
):
    reading_time = payload.timestamp if payload.timestamp else datetime.now(timezone.utc)
    if reading_time.tzinfo is None:
        reading_time = reading_time.replace(tzinfo=timezone.utc)

    # Extract metrics dict
    if isinstance(payload.metrics, dict):
        metrics_dict = payload.metrics
    elif payload.metrics is not None and hasattr(payload.metrics, "model_dump"):
        metrics_dict = payload.metrics.model_dump()
    else:
        metrics_dict = {
            "temperature": payload.temperature,
            "vibration": payload.vibration,
            "current": payload.current,
            "rpm": payload.rpm
        }

    # 1. Resolve physical device instance
    device = (
        db.query(models.Device)
        .filter(
            models.Device.device_id == payload.device_id,
            models.Device.device_instance_id == payload.device_instance_id
        )
        .first()
    )

    if not device:
        device = models.Device(
            device_id=payload.device_id,
            device_instance_id=payload.device_instance_id,
            region=payload.region,
            status="HEALTHY",
            created_at=reading_time,
            updated_at=reading_time
        )
        db.add(device)
        db.flush()

    # 2. Invoke Member 1 HealthEngine
    try:
        health_result = intelligence_service.process_reading(
            db=db,
            device_id=payload.device_id,
            device_instance_id=payload.device_instance_id,
            region=payload.region,
            metrics=metrics_dict,
            timestamp=reading_time
        )
    except Exception as e:
        logger.error(f"HealthEngine execution failed for {payload.device_id}: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HealthEngine evaluation error: {str(e)}"
        )

    raw_status = str(health_result.get("status", "HEALTHY")).upper()
    normalized_status = raw_status if raw_status in ["HEALTHY", "WARNING", "CRITICAL"] else "HEALTHY"

    device.status = normalized_status
    device.region = payload.region
    device.updated_at = reading_time

    # 3. Create sensor reading record
    sensor_record = models.SensorReading(
        device_id=payload.device_id,
        device_instance_id=payload.device_instance_id,
        region=payload.region,
        timestamp=reading_time,
        temperature=float(metrics_dict["temperature"]),
        vibration=float(metrics_dict["vibration"]),
        current=float(metrics_dict["current"]),
        rpm=float(metrics_dict["rpm"]),
        received_at=datetime.now(timezone.utc)
    )
    db.add(sensor_record)

    # 4. Create HealthResult record
    health_record = models.HealthResultRecord(
        device_id=payload.device_id,
        device_instance_id=payload.device_instance_id,
        region=payload.region,
        status=health_result.get("status", "healthy"),
        anomaly_type=health_result.get("anomaly_type", "none"),
        severity=health_result.get("severity", 0.0),
        confidence=health_result.get("confidence", 0.0),
        current_metrics=health_result.get("current_metrics", {}),
        baseline_metrics=health_result.get("baseline_metrics", {}),
        detectors=health_result.get("detectors", []),
        explanation=health_result.get("explanation", ""),
        is_mature=health_result.get("is_mature", True),
        timestamp=reading_time,
        created_at=datetime.now(timezone.utc)
    )
    db.add(health_record)

    # 5. Process Incident Lifecycle
    try:
        incident_obj, incident_action = incident_service.process_incident_lifecycle(
            db=db,
            device_id=payload.device_id,
            device_instance_id=payload.device_instance_id,
            region=payload.region,
            health_result=health_result,
            reading_timestamp=reading_time
        )
    except Exception as e:
        logger.error(f"Incident lifecycle processing failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Incident processing failed: {str(e)}"
        )

    # Backward-compatible Alert record
    if normalized_status in ["WARNING", "CRITICAL"]:
        alert = models.Alert(
            device_id=payload.device_id,
            device_instance_id=payload.device_instance_id,
            failure_type=health_result.get("anomaly_type", "unknown"),
            severity=normalized_status,
            confidence=health_result.get("confidence", 0.0),
            timestamp=reading_time
        )
        db.add(alert)

    # 6. Commit primary transaction
    try:
        db.commit()
        db.refresh(device)
    except Exception as e:
        logger.error(f"Database commit failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction failed: {str(e)}"
        )

    # 7. Post-Commit Regional Conflict Evaluation in Isolated Session
    conflict_results = []
    try:
        ConflictSessionMaker = sessionmaker(bind=db.get_bind())
        conflict_db = ConflictSessionMaker()
        try:
            conflict_results = conflict_service.evaluate_and_persist_regional_conflicts(
                db=conflict_db,
                region=payload.region,
                timestamp=reading_time
            )
        finally:
            conflict_db.close()
    except Exception as e:
        logger.error(f"Post-commit regional conflict evaluation error (telemetry preserved): {e}")

    # 8. Dispatch Real-Time WebSocket Events
    try:
        reading_dict = {
            "device_id": payload.device_id,
            "device_instance_id": payload.device_instance_id,
            "region": payload.region,
            "timestamp": reading_time.isoformat(),
            "temperature": float(metrics_dict["temperature"]),
            "vibration": float(metrics_dict["vibration"]),
            "current": float(metrics_dict["current"]),
            "rpm": float(metrics_dict["rpm"])
        }
        # 1st: telemetry_update
        await manager.broadcast({
            "event": "telemetry_update",
            "type": "telemetry_update",
            "device_id": payload.device_id,
            "device_instance_id": payload.device_instance_id,
            "region": payload.region,
            "timestamp": reading_time.isoformat(),
            "temperature": float(metrics_dict["temperature"]),
            "vibration": float(metrics_dict["vibration"]),
            "current": float(metrics_dict["current"]),
            "rpm": float(metrics_dict["rpm"]),
            "reading": reading_dict
        })

        # 2nd: incident lifecycle event
        if incident_obj and incident_action:
            serialized_inc = serialize_incident_for_ui(incident_obj, db)
            await manager.broadcast({
                "event": incident_action,
                "type": incident_action,
                "action": incident_action,
                "data": serialized_inc,
                "alert": serialized_inc,
                "incident": serialized_inc,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        # 3rd: regional conflict events
        for conf_dict, conf_action in conflict_results:
            await manager.broadcast({
                "event": "regional_conflict",
                "type": "regional_conflict",
                "action": conf_action,
                "data": conf_dict,
                "conflict": conf_dict,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    except Exception as e:
        logger.warning(f"WebSocket broadcast error: {e}")

    return health_result


@router.post(
    "/telemetry/analyze",
    response_model=schemas.HealthResultResponse,
    summary="Analyze Manual Telemetry Packet",
    description="Analyzes a manual telemetry packet through the authoritative Member 1 HealthEngine."
)
async def analyze_manual_telemetry(
    packet: ManualAnalyzePacket,
    db: Session = Depends(get_db)
):
    inst_id = packet.device_instance_id or f"INST-{packet.device_id.replace('DEV-', '')}"
    reading_payload = schemas.TelemetryIngestRequest(
        device_id=packet.device_id,
        device_instance_id=inst_id,
        region=packet.region or "North",
        timestamp=datetime.fromisoformat(packet.timestamp) if packet.timestamp else None,
        metrics={
            "temperature": packet.temperature,
            "vibration": packet.vibration,
            "current": packet.current,
            "rpm": packet.rpm
        }
    )
    return await post_reading(payload=reading_payload, db=db)


@router.get(
    "/fleet/devices/{device_id}/readings",
    include_in_schema=False
)
@router.get(
    "/devices/{device_id}/readings",
    summary="Get Historical Device Readings",
    description="Returns time-series telemetry readings for a device ordered newest first."
)
def get_device_readings(
    device_id: str,
    instance_id: Optional[str] = Query(None, description="Optional physical instance ID filter"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum readings to return"),
    db: Session = Depends(get_db)
):
    dev = db.query(models.Device).filter(models.Device.device_id == device_id).first()
    if not dev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found"
        )
    query = db.query(models.SensorReading).filter(models.SensorReading.device_id == device_id)
    if instance_id:
        query = query.filter(models.SensorReading.device_instance_id == instance_id)
    readings = query.order_by(models.SensorReading.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "device_id": r.device_id,
            "device_instance_id": r.device_instance_id,
            "region": r.region,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "temperature": r.temperature,
            "vibration": r.vibration,
            "current": r.current,
            "rpm": r.rpm
        }
        for r in readings
    ]


@router.get(
    "/telemetry/{device_id}",
    summary="Get Historical Telemetry Readings (Alias)",
    description="Returns time-series telemetry readings for a device ordered newest first."
)
def get_device_telemetry_alias(
    device_id: str,
    instance_id: Optional[str] = Query(None, description="Optional physical instance ID filter"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum readings to return"),
    db: Session = Depends(get_db)
):
    return get_device_readings(device_id=device_id, instance_id=instance_id, limit=limit, db=db)
