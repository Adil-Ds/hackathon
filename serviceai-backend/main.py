import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Existing v1 routers (SQLite pipeline — untouched) ───────────────────────
from app.api.routes import router
from app.api.streaming import router as streaming_router
from app.api.caller_routes import router as caller_router
from app.database.db import init_db

# ── New v2 routers (PostgreSQL + Redis) ─────────────────────────────────────
_v2_available = False
try:
    from app.api.v2.auth import router as auth_v2_router
    from app.api.v2.conversations import router as conversations_router
    from app.api.v2.providers import router as providers_v2_router
    from app.api.v2.bookings import router as bookings_v2_router
    from app.api.v2.search import router as search_router
    from app.api.v2.notifications import router as notifications_router
    from app.api.v2.websocket_routes import router as ws_router
    from app.websocket.manager import manager as ws_manager
    _v2_available = True
except ImportError as _e:
    print(f"[main] v2 modules not available: {_e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── startup ──────────────────────────────────────────────────
    init_db()

    if _v2_available:
        try:
            from app.core.database import engine
            from app.core.database import Base
            # Import all ORM models to register them with Base
            import app.models.orm  # noqa: F401
            async with engine.begin() as conn:
                # Create tables if they don't exist (idempotent)
                await conn.run_sync(Base.metadata.create_all)
            print("[main] PostgreSQL tables ready")
        except Exception as e:
            print(f"[main] PostgreSQL not available, skipping v2 table creation: {e}")

        try:
            await ws_manager.start_heartbeat()
            print("[main] WebSocket heartbeat started")
        except Exception as e:
            print(f"[main] WebSocket heartbeat error: {e}")

    yield

    # ── shutdown ─────────────────────────────────────────────────
    if _v2_available:
        try:
            from app.core.database import engine
            await engine.dispose()
        except Exception:
            pass
        try:
            from app.core.redis import _redis
            if _redis:
                await _redis.aclose()
        except Exception:
            pass


app = FastAPI(
    title="ServiceAI Backend",
    description=(
        "Agentic Service Provider Matching & Booking API — "
        "powered by Groq (llama-3.3-70b-versatile)"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── v1 routers ───────────────────────────────────────────────────────────────
app.include_router(router)
app.include_router(streaming_router)
app.include_router(caller_router)

# ── v2 routers ───────────────────────────────────────────────────────────────
if _v2_available:
    app.include_router(auth_v2_router)
    app.include_router(conversations_router)
    app.include_router(providers_v2_router)
    app.include_router(bookings_v2_router)
    app.include_router(search_router)
    app.include_router(notifications_router)
    app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "project": "ServiceAI",
        "challenge": "Challenge 2 — Service Provider Matching & Agentic Booking",
        "hackathon": "Google Antigravity — Al Seekho Phase II",
        "status": "running",
        "docs": "/docs",
        "version": "2.0.0",
        "features": {
            "v1": ["agent_pipeline", "bookings", "vapi_calls", "realtime_scraper"],
            "v2": ["postgresql", "redis", "websocket", "e2ee_chat", "provider_profiles"],
        },
        "endpoints": {
            "parse_intent": "POST /api/parse-intent",
            "search": "POST /api/search-providers",
            "rank": "POST /api/rank-providers",
            "book": "POST /api/book",
            "followups": "POST /api/schedule-followups",
            "full_pipeline": "POST /api/analyze",
            "providers": "GET /api/providers",
            "bookings": "GET /api/bookings",
            "auth_v2": "POST /v2/auth/sync",
            "conversations": "GET /v2/conversations",
            "websocket": "WS /ws",
        },
    }


@app.get("/health")
async def health():
    pg_ok = False
    redis_ok = False

    if _v2_available:
        try:
            from app.core.database import engine
            async with engine.connect() as conn:
                await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            pg_ok = True
        except Exception:
            pass

        try:
            from app.core.redis import get_redis
            r = await get_redis()
            await r.ping()
            redis_ok = True
        except Exception:
            pass

    return {
        "status": "ok",
        "architecture": "real-agentic",
        "orchestration": "groq-function-calling",
        "model": "llama-3.3-70b-versatile",
        "v2": {
            "postgresql": pg_ok,
            "redis": redis_ok,
        },
        "registered_tools": [
            "parse_intent", "search_providers", "rank_providers", "ask_clarification"
        ],
        "pipeline": "dynamic — Groq decides tool order and retries",
    }
