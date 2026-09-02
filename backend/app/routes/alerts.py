import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, models, schemas
from app.websocket_manager import manager
from app.routes.incidents import serialize_incident_for_ui, acknowledge_incident, resolve_incident, AcknowledgeRequest, ResolveRequest

logger = logging.getLogger("adaptive_fleet.routes.alerts")
router = APIRouter(tags=["Alerts & Incidents"])

@router.post(
    "/detections",
    response_model=schemas.DetectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Detection Result (Legacy/Compatibility)",
    description="Updates device status and creates an alert record, broadcasting device_update to WebSocket."
)
async def post_detection(
    payload: schemas.DetectionInput,
    db: Session = Depends(get_db)
):
    device = crud.get_device_by_id(db=db, device_id=payload.device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{payload.device_id}' not found in fleet directory."
        )

    try:
        device = crud.update_device_status(db=db, device_id=payload.device_id, status=payload.status)
        alert = crud.create_alert(db=db, alert=payload)
    except Exception as e:
        logger.error(f"Database write failure in /detections: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction failed: {str(e)}"
        )

    try:
        await manager.broadcast({
            "event": "device_update",
            "type": "device_update",
            "device_id": device.device_id,
            "status": device.status,
            "failure_type": payload.failure_type,
            "anomaly_type": payload.failure_type,
            "severity": payload.severity if hasattr(payload, "severity") else 0.8,
            "confidence": payload.confidence,
            "explanation": f"Detection: {payload.failure_type} ({payload.status})",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed on detection: {e}")

    return {
        "message": "Detection result successfully processed and recorded.",
        "device_id": device.device_id,
        "status": device.status,
        "alert": alert
    }

@router.get(
    "/alerts",
    summary="Get Operational Alerts & Incidents",
    description="Returns all operational incidents and alerts formatted for frontend consumption."
)
def get_all_alerts(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    limit: int = Query(100, ge=1, le=1000, description="Max alerts to return"),
    db: Session = Depends(get_db)
):
    query = db.query(models.Incident)
    if device_id:
        query = query.filter(models.Incident.device_id == device_id)
    if severity:
        sev_upper = severity.upper()
        if sev_upper in ["CRITICAL", "WARNING", "HEALTHY"]:
            if sev_upper == "CRITICAL":
                query = query.filter(models.Incident.severity >= 0.8)
            elif sev_upper == "WARNING":
                query = query.filter(models.Incident.severity < 0.8)

    incidents = query.order_by(models.Incident.last_detected_at.desc()).limit(limit).all()
    return [serialize_incident_for_ui(i, db) for i in incidents]

@router.get("/alerts/{alert_id}", summary="Get Alert by ID")
def get_alert_by_id(alert_id: str, db: Session = Depends(get_db)):
    inc = db.query(models.Incident).filter(
        (models.Incident.incident_id == alert_id) | (models.Incident.id == alert_id)
    ).first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert '{alert_id}' not found")
    return serialize_incident_for_ui(inc, db)

@router.post("/alerts/{alert_id}/acknowledge", summary="Acknowledge Alert")
async def acknowledge_alert_endpoint(
    alert_id: str,
    payload: Optional[AcknowledgeRequest] = None,
    db: Session = Depends(get_db)
):
    return await acknowledge_incident(incident_id=alert_id, payload=payload, db=db)

@router.post("/alerts/{alert_id}/resolve", summary="Resolve Alert")
async def resolve_alert_endpoint(
    alert_id: str,
    payload: Optional[ResolveRequest] = None,
    db: Session = Depends(get_db)
):
    return await resolve_incident(incident_id=alert_id, payload=payload, db=db)
