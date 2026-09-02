import logging
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger("adaptive_fleet.websocket")

class ConnectionManager:
    """Manages concurrent WebSocket connections and thread-safe broadcasts."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active connections: {len(self.active_connections)}")

    async def send_personal_json(self, data: Dict[str, Any], websocket: WebSocket):
        """Send message to a specific client."""
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.warning(f"Error sending personal message to client: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a JSON message to all currently connected clients safely."""
        if not self.active_connections:
            logger.info("No active WebSocket clients connected to receive broadcast.")
            return

        disconnected_clients = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to client ({e}); marking for removal.")
                disconnected_clients.append(connection)

        for connection in disconnected_clients:
            self.disconnect(connection)

        logger.info(f"Broadcast event '{message.get('event')}' delivered to {len(self.active_connections)} client(s).")

# Global singleton instance
manager = ConnectionManager()
