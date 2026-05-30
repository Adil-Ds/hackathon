from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.manager import manager
from app.websocket.handlers import handle_message

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    WebSocket endpoint. Clients connect with:
        ws://<host>/ws?token=<jwt_or_firebase_token>
    """
    user_id = await manager.connect(websocket, token)
    if not user_id:
        return

    try:
        while True:
            data = await websocket.receive_json()
            await handle_message(websocket, user_id, data)
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
    except Exception:
        await manager.disconnect(websocket, user_id)
