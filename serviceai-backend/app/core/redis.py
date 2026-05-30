"""
Redis helpers — gracefully degrade when Redis is unavailable.
All functions are safe to call even if Redis is not running; they silently
return None/0/False so the rest of the app keeps working.
"""
import json
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import settings

_redis: Optional[aioredis.Redis] = None
_redis_available: bool = True   # optimistic; flipped False on first failure


async def get_redis() -> Optional[aioredis.Redis]:
    global _redis, _redis_available
    if not _redis_available:
        return None
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def _exec(coro_factory):
    """Run a Redis command, returning None and disabling Redis on any error."""
    global _redis_available, _redis
    r = await get_redis()
    if r is None:
        return None
    try:
        return await coro_factory(r)
    except Exception:
        _redis_available = False
        _redis = None
        return None


async def set_user_online(user_id: str, ttl: int = 300):
    await _exec(lambda r: r.setex(f"presence:{user_id}", ttl, "1"))


async def is_user_online(user_id: str) -> bool:
    val = await _exec(lambda r: r.exists(f"presence:{user_id}"))
    return (val or 0) > 0


async def set_typing(conversation_id: str, user_id: str, ttl: int = 5):
    await _exec(lambda r: r.setex(f"typing:{conversation_id}:{user_id}", ttl, "1"))


async def clear_typing(conversation_id: str, user_id: str):
    await _exec(lambda r: r.delete(f"typing:{conversation_id}:{user_id}"))


async def is_typing(conversation_id: str, user_id: str) -> bool:
    val = await _exec(lambda r: r.exists(f"typing:{conversation_id}:{user_id}"))
    return (val or 0) > 0


async def cache_set(key: str, value: dict, ttl: int = 300):
    await _exec(lambda r: r.setex(key, ttl, json.dumps(value)))


async def cache_get(key: str) -> Optional[dict]:
    val = await _exec(lambda r: r.get(key))
    if val:
        try:
            return json.loads(val)
        except Exception:
            return None
    return None


async def cache_delete(key: str):
    await _exec(lambda r: r.delete(key))


async def publish(channel: str, message: dict):
    await _exec(lambda r: r.publish(channel, json.dumps(message)))


async def increment(key: str, by: int = 1) -> int:
    val = await _exec(lambda r: r.incrby(key, by))
    return int(val) if val else 0


async def get_int(key: str) -> int:
    val = await _exec(lambda r: r.get(key))
    return int(val) if val else 0


async def reset_key(key: str):
    await _exec(lambda r: r.delete(key))
