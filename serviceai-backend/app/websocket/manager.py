import asyncio
import json
import logging
from typing import Optional

from fastapi import WebSocket

from app.core.config import settings
from app.core.redis import set_user_online
from app.core.security import resolve_token

logger = logging.getLogger(__name__)

MAX_CONNECTIONS_PER_USER = 5
HEARTBEAT_INTERVAL = 30


class ConnectionManager:
    def __init__(self):
        # user_id -> list of WebSocket connections
        self._connections: dict[str, list[WebSocket]] = {}
        self._pubsub_tasks: dict[str, asyncio.Task] = {}
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, token: Optional[str]) -> Optional[str]:
        user_id = await self._authenticate(token)
        if not user_id:
            await websocket.close(code=4001, reason="Unauthorized")
            return None

        await websocket.accept()

        if user_id not in self._connections:
            self._connections[user_id] = []

        conns = self._connections[user_id]
        if len(conns) >= MAX_CONNECTIONS_PER_USER:
            old = conns.pop(0)
            try:
                await old.close(code=4002, reason="Max connections reached")
            except Exception:
                pass

        conns.append(websocket)
        await set_user_online(user_id)

        await self._broadcast_presence(user_id, online=True)

        # Start Redis pub/sub listener — silently skip if Redis is unavailable
        if user_id not in self._pubsub_tasks:
            task = asyncio.create_task(self._redis_listener(user_id))
            self._pubsub_tasks[user_id] = task

        logger.info(f"[WS] User {user_id} connected ({len(conns)} connections)")
        return user_id

    async def disconnect(self, websocket: WebSocket, user_id: str):
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)

        if not conns:
            self._connections.pop(user_id, None)
            task = self._pubsub_tasks.pop(user_id, None)
            if task:
                task.cancel()
            await self._broadcast_presence(user_id, online=False)

        logger.info(f"[WS] User {user_id} disconnected")

    async def send_to_user(self, user_id: str, message: dict):
        conns = self._connections.get(user_id, [])
        dead = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in conns:
                conns.remove(ws)

    async def broadcast_to_conversation(
        self, conversation_id: str, message: dict, sender_id: str = None
    ):
        """
        Deliver a message to all connected participants of a conversation.
        Works entirely in-memory — Redis not required.
        """
        try:
            from app.database.db import get_connection
            conn = get_connection()
            rows = conn.execute(
                "SELECT user_id FROM conversation_participants WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchall()
            conn.close()
        except Exception:
            return

        for row in rows:
            uid = row["user_id"]
            await self.send_to_user(uid, message)

    async def _authenticate(self, token: Optional[str]) -> Optional[str]:
        if not token:
            return None
        user = resolve_token(token)
        return user.uid if user else None

    async def _broadcast_presence(self, user_id: str, online: bool):
        message = {
            "type": "presence_online" if online else "presence_offline",
            "user_id": user_id,
        }
        for uid, conns in list(self._connections.items()):
            if uid != user_id:
                dead = []
                for ws in conns:
                    try:
                        await ws.send_json(message)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    if ws in conns:
                        conns.remove(ws)

    async def _redis_listener(self, user_id: str):
        """
        Subscribe to Redis pub/sub for this user.
        Silently exits if Redis is unavailable — direct delivery via
        broadcast_to_conversation() handles real-time in that case.
        """
        redis_conn = None
        try:
            import redis.asyncio as aioredis
            redis_conn = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            # Quick ping to confirm Redis is up before we start listening
            await asyncio.wait_for(redis_conn.ping(), timeout=2.0)

            pubsub = redis_conn.pubsub()
            await pubsub.psubscribe(f"user:{user_id}:*", "conv:*")

            async for message in pubsub.listen():
                if message["type"] not in ("message", "pmessage"):
                    continue
                try:
                    data = json.loads(message["data"])
                except Exception:
                    continue

                conns = self._connections.get(user_id)
                if not conns:
                    break

                dead = []
                for ws in conns:
                    try:
                        await ws.send_json(data)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    if ws in conns:
                        conns.remove(ws)

        except asyncio.CancelledError:
            pass
        except Exception:
            # Redis not available — that's fine; direct delivery handles it
            pass
        finally:
            if redis_conn:
                try:
                    await redis_conn.aclose()
                except Exception:
                    pass

    async def start_heartbeat(self):
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def _heartbeat_loop(self):
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            dead_users = []
            for user_id, conns in list(self._connections.items()):
                dead_ws = []
                for ws in conns:
                    try:
                        await ws.send_json({"type": "ping"})
                    except Exception:
                        dead_ws.append(ws)
                for ws in dead_ws:
                    if ws in conns:
                        conns.remove(ws)
                if not conns:
                    dead_users.append(user_id)
            for user_id in dead_users:
                self._connections.pop(user_id, None)
                task = self._pubsub_tasks.pop(user_id, None)
                if task:
                    task.cancel()


manager = ConnectionManager()
