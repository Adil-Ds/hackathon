"""
Conversations v2 — SQLite-backed (no PostgreSQL required).
Real-time delivery via in-memory WebSocket broadcast (no Redis required).
"""
import asyncio
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import AuthenticatedUser, get_current_user
from app.database.db import get_connection

router = APIRouter(prefix="/v2/conversations", tags=["conversations"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    display_name: str


class ConversationCreate(BaseModel):
    participant_ids: List[str]
    booking_id: Optional[str] = None
    encrypted_keys: dict = {}
    participant_names: dict = {}      # {user_id: display_name}


class ConversationOut(BaseModel):
    id: str
    booking_id: Optional[str] = None
    booking_status: Optional[str] = None
    other_participant_name: Optional[str] = None
    is_active: bool = True
    created_at: str
    last_message_at: Optional[str] = None
    participant_ids: List[str] = []
    unread_count: int = 0
    last_message_preview: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    encrypted_payload: str          # field name kept for API compat — contains plaintext
    message_type: str = "text"
    is_deleted: bool = False
    created_at: str
    read_by: List[str] = []


class SendMessageRequest(BaseModel):
    encrypted_payload: str          # actually plaintext in this SQLite-backed version
    message_type: str = "text"


# ── SQLite helpers ────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"   # explicit UTC so JS parses correctly


def _get_user_conversations(user_id: str) -> List[dict]:
    conn = get_connection()
    rows = conn.execute("""
        SELECT c.id, c.booking_id, c.is_active, c.created_at, c.last_message_at,
               COALESCE(cu.unread_count, 0) AS unread_count
        FROM conversations c
        JOIN conversation_participants cp ON cp.conversation_id = c.id
        LEFT JOIN conversation_unread cu
               ON cu.conversation_id = c.id AND cu.user_id = ?
        WHERE cp.user_id = ?
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    """, (user_id, user_id)).fetchall()

    result = []
    for row in rows:
        participants = conn.execute(
            "SELECT user_id, display_name FROM conversation_participants WHERE conversation_id = ?",
            (row["id"],)
        ).fetchall()

        last_msg = conn.execute(
            "SELECT encrypted_payload FROM messages "
            "WHERE conversation_id = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1",
            (row["id"],)
        ).fetchone()

        booking_status = None
        other_participant_name = None

        if row["booking_id"]:
            bk = conn.execute(
                "SELECT status, provider_name, user_name, user_id FROM bookings WHERE id = ?",
                (row["booking_id"],)
            ).fetchone()
            if bk:
                booking_status = bk["status"]
                # Show the OTHER person's name contextually
                if user_id == bk["user_id"]:
                    other_participant_name = bk["provider_name"]
                else:
                    other_participant_name = bk["user_name"]

        # Fallback 1 — display_name stored when conversation was created
        if not other_participant_name:
            for p in participants:
                if p["user_id"] != user_id and p["display_name"]:
                    other_participant_name = p["display_name"]
                    break

        # Fallback 2 — global chat_users table (populated on every login)
        if not other_participant_name:
            for p in participants:
                if p["user_id"] != user_id:
                    cu = conn.execute(
                        "SELECT display_name FROM chat_users WHERE user_id = ?",
                        (p["user_id"],)
                    ).fetchone()
                    if cu and cu["display_name"]:
                        other_participant_name = cu["display_name"]
                        break

        result.append({
            "id": row["id"],
            "booking_id": row["booking_id"],
            "booking_status": booking_status,
            "other_participant_name": other_participant_name,
            "is_active": bool(row["is_active"]),
            "created_at": row["created_at"],
            "last_message_at": row["last_message_at"],
            "participant_ids": [p["user_id"] for p in participants],
            "unread_count": row["unread_count"] or 0,
            "last_message_preview": last_msg["encrypted_payload"] if last_msg else None,
        })

    conn.close()
    return result


def _find_existing_conversation(participant_ids: List[str]) -> Optional[dict]:
    if len(participant_ids) != 2:
        return None
    conn = get_connection()
    rows = conn.execute("""
        SELECT cp1.conversation_id
        FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        WHERE cp1.user_id = ? AND cp2.user_id = ?
    """, (participant_ids[0], participant_ids[1])).fetchall()

    for row in rows:
        count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM conversation_participants WHERE conversation_id = ?",
            (row["conversation_id"],)
        ).fetchone()["cnt"]
        if count == 2:
            existing = conn.execute(
                "SELECT * FROM conversations WHERE id = ?",
                (row["conversation_id"],)
            ).fetchone()
            participants = conn.execute(
                "SELECT user_id FROM conversation_participants WHERE conversation_id = ?",
                (row["conversation_id"],)
            ).fetchall()
            conn.close()
            return {
                "id": existing["id"],
                "booking_id": existing["booking_id"],
                "booking_status": None,
                "other_participant_name": None,
                "is_active": bool(existing["is_active"]),
                "created_at": existing["created_at"],
                "last_message_at": existing["last_message_at"],
                "participant_ids": [p["user_id"] for p in participants],
                "unread_count": 0,
                "last_message_preview": None,
            }
    conn.close()
    return None


def _create_conversation(
    participant_ids: List[str],
    booking_id: Optional[str] = None,
    participant_names: Optional[dict] = None,
) -> dict:
    if booking_id is None:
        existing = _find_existing_conversation(participant_ids)
        if existing:
            # Update display names if provided and not already stored
            if participant_names:
                conn = get_connection()
                for uid, name in participant_names.items():
                    if name:
                        conn.execute(
                            "UPDATE conversation_participants SET display_name = ? "
                            "WHERE conversation_id = ? AND user_id = ? AND (display_name IS NULL OR display_name = '')",
                            (name, existing["id"], uid),
                        )
                conn.commit()
                conn.close()
            return existing

    conv_id = str(uuid.uuid4())
    now = _now()
    conn = get_connection()
    conn.execute(
        "INSERT INTO conversations (id, booking_id, is_active, created_at) VALUES (?, ?, 1, ?)",
        (conv_id, booking_id, now),
    )
    for uid in participant_ids:
        name = (participant_names or {}).get(uid, "")
        conn.execute(
            "INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id, display_name) VALUES (?, ?, ?)",
            (conv_id, uid, name),
        )
    conn.commit()
    conn.close()

    return {
        "id": conv_id,
        "booking_id": booking_id,
        "booking_status": None,
        "other_participant_name": None,
        "is_active": True,
        "created_at": now,
        "last_message_at": None,
        "participant_ids": participant_ids,
        "unread_count": 0,
        "last_message_preview": None,
    }


def _is_participant(conversation_id: str, user_id: str) -> bool:
    conn = get_connection()
    row = conn.execute(
        "SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
        (conversation_id, user_id),
    ).fetchone()
    conn.close()
    return row is not None


def _get_messages(conversation_id: str, before_id: Optional[str], limit: int) -> List[dict]:
    conn = get_connection()
    if before_id:
        ref = conn.execute("SELECT created_at FROM messages WHERE id = ?", (before_id,)).fetchone()
        if ref:
            rows = conn.execute(
                "SELECT * FROM messages WHERE conversation_id = ? AND created_at < ? "
                "AND is_deleted = 0 ORDER BY created_at DESC LIMIT ?",
                (conversation_id, ref["created_at"], limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM messages WHERE conversation_id = ? AND is_deleted = 0 "
                "ORDER BY created_at DESC LIMIT ?",
                (conversation_id, limit),
            ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? AND is_deleted = 0 "
            "ORDER BY created_at DESC LIMIT ?",
            (conversation_id, limit),
        ).fetchall()

    result = []
    for row in rows:
        read_by = conn.execute(
            "SELECT user_id FROM message_read_receipts WHERE message_id = ?",
            (row["id"],),
        ).fetchall()
        result.append({
            "id": row["id"],
            "conversation_id": row["conversation_id"],
            "sender_id": row["sender_id"],
            "encrypted_payload": row["encrypted_payload"],
            "message_type": row["message_type"],
            "is_deleted": bool(row["is_deleted"]),
            "created_at": row["created_at"],
            "read_by": [r["user_id"] for r in read_by],
        })

    conn.close()
    return list(reversed(result))


def _send_message(conversation_id: str, sender_id: str, payload: str, message_type: str) -> dict:
    msg_id = str(uuid.uuid4())
    now = _now()
    conn = get_connection()
    conn.execute(
        "INSERT INTO messages "
        "(id, conversation_id, sender_id, encrypted_payload, message_type, is_deleted, created_at) "
        "VALUES (?, ?, ?, ?, ?, 0, ?)",
        (msg_id, conversation_id, sender_id, payload, message_type, now),
    )
    conn.execute(
        "UPDATE conversations SET last_message_at = ? WHERE id = ?",
        (now, conversation_id),
    )
    others = conn.execute(
        "SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?",
        (conversation_id, sender_id),
    ).fetchall()
    for p in others:
        conn.execute("""
            INSERT INTO conversation_unread (conversation_id, user_id, unread_count)
            VALUES (?, ?, 1)
            ON CONFLICT(conversation_id, user_id) DO UPDATE SET unread_count = unread_count + 1
        """, (conversation_id, p["user_id"]))
    conn.commit()
    conn.close()

    return {
        "id": msg_id,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "encrypted_payload": payload,
        "message_type": message_type,
        "is_deleted": False,
        "created_at": now,
        "read_by": [],
    }


def _mark_read(conversation_id: str, user_id: str) -> int:
    conn = get_connection()
    msgs = conn.execute(
        "SELECT id FROM messages WHERE conversation_id = ? AND sender_id != ? AND is_deleted = 0",
        (conversation_id, user_id),
    ).fetchall()
    count = 0
    for msg in msgs:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO message_read_receipts (message_id, user_id) VALUES (?, ?)",
                (msg["id"], user_id),
            )
            count += 1
        except Exception:
            pass
    conn.execute(
        "INSERT OR REPLACE INTO conversation_unread (conversation_id, user_id, unread_count) VALUES (?, ?, 0)",
        (conversation_id, user_id),
    )
    conn.commit()
    conn.close()
    return count


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ConversationOut])
async def list_conversations(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return _get_user_conversations(current_user.uid)


@router.post("", response_model=ConversationOut)
async def create_conversation(
    body: ConversationCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    all_ids = list(set([current_user.uid] + body.participant_ids))
    return _create_conversation(all_ids, body.booking_id, body.participant_names or {})


@router.get("/{conversation_id}/messages", response_model=List[MessageOut])
async def get_messages(
    conversation_id: str,
    before_id: Optional[str] = None,
    limit: int = 50,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if not _is_participant(conversation_id, current_user.uid):
        raise HTTPException(status_code=403, detail="Not a participant")
    return _get_messages(conversation_id, before_id, limit)


@router.post("/{conversation_id}/messages", response_model=MessageOut)
async def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if not _is_participant(conversation_id, current_user.uid):
        raise HTTPException(status_code=403, detail="Not a participant")

    msg_data = _send_message(
        conversation_id, current_user.uid, body.encrypted_payload, body.message_type
    )

    # Broadcast to all connected participants in real-time (no Redis needed)
    try:
        from app.websocket.manager import manager as ws_manager
        asyncio.create_task(
            ws_manager.broadcast_to_conversation(
                conversation_id,
                {
                    "type": "new_message",
                    "conversation_id": conversation_id,
                    "message": msg_data,
                },
                sender_id=current_user.uid,
            )
        )
    except Exception:
        pass  # Real-time delivery is best-effort; HTTP response is authoritative

    return msg_data


@router.post("/{conversation_id}/read")
async def mark_read(
    conversation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if not _is_participant(conversation_id, current_user.uid):
        raise HTTPException(status_code=403, detail="Not a participant")
    count = _mark_read(conversation_id, current_user.uid)
    return {"marked_read": count}


@router.post("/{conversation_id}/typing")
async def typing_indicator(
    conversation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if not _is_participant(conversation_id, current_user.uid):
        raise HTTPException(status_code=403, detail="Not a participant")

    try:
        from app.websocket.manager import manager as ws_manager
        asyncio.create_task(
            ws_manager.broadcast_to_conversation(
                conversation_id,
                {
                    "type": "typing_start",
                    "conversation_id": conversation_id,
                    "user_id": current_user.uid,
                },
                sender_id=current_user.uid,
            )
        )
    except Exception:
        pass
    return {"ok": True}


@router.post("/register-user")
async def register_user_name(
    body: UserRegisterRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Store / update the calling user's display name in SQLite.
    Called on every login so conversation lists always show correct names.
    """
    now = _now()
    conn = get_connection()
    conn.execute("""
        INSERT INTO chat_users (user_id, display_name, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at
    """, (current_user.uid, body.display_name.strip(), now))
    conn.commit()
    conn.close()
    return {"ok": True, "user_id": current_user.uid, "display_name": body.display_name.strip()}
