from fastapi import WebSocket

from app.core import redis as r
from app.websocket.manager import manager


async def handle_message(websocket: WebSocket, user_id: str, data: dict):
    msg_type = data.get("type", "")

    if msg_type == "subscribe_conversation":
        conv_id = data.get("conversation_id")
        if conv_id:
            await websocket.send_json({"type": "subscribed", "conversation_id": conv_id})

    elif msg_type == "typing_start":
        conv_id = data.get("conversation_id")
        if conv_id:
            await r.set_typing(conv_id, user_id)
            await r.publish(
                f"conv:{conv_id}",
                {"type": "typing_start", "conversation_id": conv_id, "user_id": user_id},
            )

    elif msg_type == "typing_stop":
        conv_id = data.get("conversation_id")
        if conv_id:
            await r.clear_typing(conv_id, user_id)
            await r.publish(
                f"conv:{conv_id}",
                {"type": "typing_stop", "conversation_id": conv_id, "user_id": user_id},
            )

    elif msg_type == "mark_read":
        conv_id = data.get("conversation_id")
        if conv_id:
            await r.reset_key(f"unread:{user_id}:{conv_id}")
            await r.publish(
                f"conv:{conv_id}",
                {"type": "message_read", "conversation_id": conv_id, "user_id": user_id},
            )

    elif msg_type == "pong":
        # heartbeat response — no-op
        pass
