import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, incident_service
from app.websocket_manager import manager

logger = logging.getLogger("adaptive_fleet.routes.incidents")
router = APIRouter(prefix="/incidents", tags=["Incidents"])

class AcknowledgeRequest(BaseModel):
    username: Optional[str] = "Operator 01"

class ResolveRequest(BaseModel):
    username: Optional[str] = "Operator 01"
    reason: Optional[str] = "Operator inspection completed"

def format_iso_utc(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    # Return formatted ISO string with Z
    return dt.isoformat().replace("+00:00", "Z")

def serialize_incident_for_ui(inc: models.Incident, db: Session) -> dict:
    """Produce rich serialized incident object matching frontend expectations."""
    hr = (
        db.query(models.HealthResultRecord)
        .filter(
            models.HealthResultRecord.device_id == inc.device_id,
            models.HealthResultRecord.device_instance_id == inc.device_instance_id
        )
        .order_by(models.HealthResultRecord.timestamp.desc())
        .first()
    )
    cm = hr.current_metrics if hr else {}
    bm = hr.baseline_metrics if hr else {}
    detectors = hr.detectors if hr else []

    ts_str = format_iso_utc(inc.last_detected_at) or format_iso_utc(inc.created_at)

    return {
        "id": inc.incident_id,
        "incident_id": inc.incident_id,
        "device_id": inc.device_id,
        "device_instance_id": inc.device_instance_id,
        "region": inc.region,
        "anomaly_type": inc.anomaly_type,
        "severity": inc.severity,
        "confidence": inc.confidence,
        "status": inc.status,
        "lifecycle_status": inc.status,
        "occurrence_count": inc.occurrence_count,
        "peak_severity": inc.peak_severity,
        "peak_confidence": inc.peak_confidence,
        "is_transient": bool(inc.is_transient),
        "explanation": inc.latest_explanation or "Anomalous telemetry detected.",
        "latest_explanation": inc.latest_explanation or "Anomalous telemetry detected.",
        "timestamp": ts_str,
        "first_detected_at": format_iso_utc(inc.first_detected_at),
        "last_detected_at": format_iso_utc(inc.last_detected_at),
        "acknowledged_at": format_iso_utc(inc.acknowledged_at),
        "acknowledged_by": inc.acknowledged_by,
        "resolved_at": format_iso_utc(inc.resolved_at),
        "resolved_by": inc.resolved_by,
        "resolution_reason": inc.resolution_reason,
        "acknowledged": inc.status in ["ACKNOWLEDGED", "RESOLVED"],
        "current_metrics": cm,
        "baseline_metrics": bm,
        "detectors": detectors
    }

@router.get("", summary="Get Incidents")
def get_incidents(
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED)"),
    region: Optional[str] = Query(None, description="Filter by region"),
    anomaly_type: Optional[str] = Query(None, description="Filter by anomaly type"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    device_instance_id: Optional[str] = Query(None, description="Filter by device instance ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    if status and status.upper() not in ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]:
        raise HTTPException(status_code=422, detail=f"Invalid status '{status}'. Must be ACTIVE, ACKNOWLEDGED, or RESOLVED.")
    if anomaly_type and anomaly_type.lower() not in ["drift", "spike", "flatline", "oscillation", "sensor_swap"]:
        raise HTTPException(status_code=422, detail=f"Invalid anomaly_type '{anomaly_type}'.")

    query = db.query(models.Incident)
    if status:
        query = query.filter(models.Incident.status == status.upper())
    if region:
        query = query.filter(models.Incident.region == region)
    if anomaly_type:
        query = query.filter(models.Incident.anomaly_type == anomaly_type.lower())
    if device_id:
        query = query.filter(models.Incident.device_id == device_id)
    if device_instance_id:
        query = query.filter(models.Incident.device_instance_id == device_instance_id)

    incidents = query.order_by(models.Incident.last_detected_at.desc()).offset(skip).limit(limit).all()
    return [serialize_incident_for_ui(i, db) for i in incidents]

@router.get("/{incident_id}", summary="Get Incident by ID")
def get_incident_by_id(incident_id: str, db: Session = Depends(get_db)):
    inc = db.query(models.Incident).filter(
        (models.Incident.incident_id == incident_id) | (models.Incident.id == incident_id)
    ).first()
    if not inc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_id}' not found")
    return serialize_incident_for_ui(inc, db)

@router.post("/{incident_id}/acknowledge", summary="Acknowledge Incident")
async def acknowledge_incident(
    incident_id: str,
    payload: Optional[AcknowledgeRequest] = None,
    db: Session = Depends(get_db)
):
    operator_name = payload.username if payload and payload.username else "Operator 01"
    inc = incident_service.acknowledge_incident(db, incident_id, operator_name)
    if not inc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_id}' not found or already acknowledged/resolved")

    serialized = serialize_incident_for_ui(inc, db)
    await manager.broadcast({
        "event": "alert_acknowledged",
        "type": "alert_acknowledged",
        "incident_id": inc.incident_id,
        "device_id": inc.device_id,
        "operator": operator_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": serialized,
        "alert": serialized,
        "incident": serialized
    })
    return serialized

@router.post("/{incident_id}/resolve", summary="Resolve Incident")
async def resolve_incident(
    incident_id: str,
    payload: Optional[ResolveRequest] = None,
    db: Session = Depends(get_db)
):
    operator_name = payload.username if payload and payload.username else "Operator 01"
    reason = payload.reason if payload and payload.reason else "Operator inspection completed"
    inc = incident_service.resolve_incident(db, incident_id, operator_name, reason)
    if not inc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_id}' not found or already resolved")

    serialized = serialize_incident_for_ui(inc, db)
    await manager.broadcast({
        "event": "alert_resolved",
        "type": "alert_resolved",
        "incident_id": inc.incident_id,
        "device_id": inc.device_id,
        "operator": operator_name,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": serialized,
        "alert": serialized,
        "incident": serialized
    })
    return serialized
