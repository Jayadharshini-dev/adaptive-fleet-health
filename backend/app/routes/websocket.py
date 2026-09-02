import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.websocket_manager import manager
from app import crud

logger = logging.getLogger("adaptive_fleet.websocket")
router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/fleet")
async def websocket_fleet_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """Real-time WebSocket endpoint for fleet monitoring dashboards."""
    await manager.connect(websocket)
    try:
        # Send initial authoritative fleet snapshot on connection
        devices = crud.get_devices(db=db, limit=500)
        snapshot = {
            "event": "fleet_snapshot",
            "devices": [
                {
                    "device_id": d.device_id,
                    "region": d.region,
                    "status": d.status
                }
                for d in devices
            ]
        }
        await manager.send_personal_json(snapshot, websocket)
        logger.info(f"Sent fleet snapshot ({len(devices)} devices) to newly connected client.")

        # Keep connection open and listen for client heartbeats or messages
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"Unexpected WebSocket error: {e}")
        manager.disconnect(websocket)
