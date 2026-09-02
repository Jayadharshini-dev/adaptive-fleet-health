import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.websocket_manager import manager
from app import crud, schemas, models
from app.routes.incidents import serialize_incident_for_ui, acknowledge_incident_route, resolve_incident_route, AcknowledgeRequest, ResolveRequest

logger = logging.getLogger("adaptive_fleet.alerts")
router = APIRouter(tags=["Alerts & Detections"])

@router.get(
    "/alerts",
    summary="Get recent fleet alerts / incidents",
    description="Retrieve all triggered anomaly alerts/incidents, ordered newest first. Supports limit."
)
def get_all_alerts(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of alerts to return"),
    device_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Incident)
    if device_id:
        query = query.filter(models.Incident.device_id == device_id)
    incidents = query.order_by(models.Incident.last_detected_at.desc()).limit(limit).all()
    if incidents:
        return [serialize_incident_for_ui(inc, db) for inc in incidents]
    return crud.get_alerts(db=db, limit=limit)

@router.post(
    "/detections",
    response_model=schemas.DetectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Receive detection result & broadcast state change (Legacy)",
    description="Contract endpoint for legacy Person 3 Detection Engine."
)
async def post_detection_result(
    detection: schemas.DetectionInput,
    db: Session = Depends(get_db)
):
    device = crud.get_device_by_id(db=db, device_id=detection.device_id)
    if not device:
        logger.warning(f"Detection rejected: device {detection.device_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {detection.device_id} not found"
        )

    try:
        device.status = detection.status
        db_alert = models.Alert(
            device_id=detection.device_id,
            failure_type=detection.failure_type,
            severity=detection.status,
            confidence=detection.confidence,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(db_alert)
        db.commit()
        db.refresh(db_alert)
        db.refresh(device)
        logger.info(f"DB Committed: Device {device.device_id} status -> {device.status}, Alert ID={db_alert.id}")
    except Exception as e:
        db.rollback()
        logger.error(f"DB Transaction failed for device {detection.device_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction failed during detection processing"
        )

    event_payload = {
        "event": "device_update",
        "type": "device_update",
        "device_id": device.device_id,
        "region": device.region,
        "status": device.status,
        "failure_type": detection.failure_type,
        "confidence": detection.confidence,
        "timestamp": db_alert.timestamp.isoformat()
    }
    await manager.broadcast(event_payload)
    logger.info(f"WebSocket broadcast dispatched: {event_payload['device_id']} is {event_payload['status']}")

    return schemas.DetectionResponse(
        message=f"Detection processed successfully for device {detection.device_id}",
        device_id=detection.device_id,
        status=detection.status,
        alert=db_alert
    )

@router.post("/alerts/{alert_id}/acknowledge", summary="Acknowledge Alert")
async def acknowledge_alert(
    alert_id: str,
    payload: Optional[AcknowledgeRequest] = None,
    db: Session = Depends(get_db)
):
    return await acknowledge_incident_route(incident_id=alert_id, payload=payload, db=db)

@router.post("/alerts/{alert_id}/resolve", summary="Resolve Alert")
async def resolve_alert(
    alert_id: str,
    payload: Optional[ResolveRequest] = None,
    db: Session = Depends(get_db)
):
    return await resolve_incident_route(incident_id=alert_id, payload=payload, db=db)
