import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.websocket_manager import manager
from app import crud, models, conflict_service
from app.routes.incidents import serialize_incident_for_ui

logger = logging.getLogger("adaptive_fleet.websocket")
router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/fleet")
async def websocket_fleet_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """Real-time WebSocket endpoint for fleet monitoring dashboards."""
    await manager.connect(websocket)
    try:
        # 1. Fetch devices
        devices = crud.get_devices(db=db, limit=500)
        
        # 2. Fetch fleet summary
        summary = crud.get_fleet_summary(db=db)
        
        # 3. Fetch regions breakdown
        regions = crud.get_regions_summary(db=db)
        
        # 4. Fetch all incidents/alerts
        incidents = db.query(models.Incident).order_by(models.Incident.last_detected_at.desc()).limit(100).all()
        serialized_incidents = [serialize_incident_for_ui(i, db) for i in incidents]
        
        # 5. Fetch active regional conflicts
        conflicts = db.query(models.RegionalConflict).filter(models.RegionalConflict.status == "ACTIVE").all()
        serialized_conflicts = [conflict_service.serialize_conflict(c) for c in conflicts]

        snapshot = {
            "event": "fleet_snapshot",
            "type": "fleet_snapshot",
            "devices": [
                {
                    "device_id": d.device_id,
                    "device_instance_id": d.device_instance_id,
                    "region": d.region,
                    "status": d.status
                }
                for d in devices
            ],
            "summary": summary,
            "regions": regions,
            "alerts": serialized_incidents,
            "incidents": serialized_incidents,
            "conflicts": serialized_conflicts
        }
        await manager.send_personal_json(snapshot, websocket)
        logger.info(f"Sent comprehensive fleet snapshot ({len(devices)} devices, {len(serialized_incidents)} incidents) to newly connected client.")

        # Keep connection open and listen for client heartbeats or messages
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"Unexpected WebSocket error: {e}")
        manager.disconnect(websocket)
