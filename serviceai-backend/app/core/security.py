import os
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

_firebase_app = None
_firebase_init_attempted = False


def _get_firebase_app():
    global _firebase_app, _firebase_init_attempted
    if _firebase_init_attempted:
        return _firebase_app

    _firebase_init_attempted = True
    sa_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    if not sa_path or not os.path.exists(sa_path):
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate(sa_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("[security] Firebase Admin SDK initialised from service account")
    except Exception as e:
        logger.warning(f"[security] Firebase Admin SDK init failed: {e}")
        _firebase_app = None

    return _firebase_app


@dataclass
class AuthenticatedUser:
    uid: str
    email: Optional[str]
    role: str = "user"
    firebase_uid: Optional[str] = None


# ── Verification methods (tried in order) ────────────────────────────────────

def verify_firebase_token(token: str) -> Optional[AuthenticatedUser]:
    """Full verification via Firebase Admin SDK (requires service account)."""
    app = _get_firebase_app()
    if not app:
        return None
    try:
        from firebase_admin import auth
        decoded = auth.verify_id_token(token)
        return AuthenticatedUser(
            uid=decoded["uid"],
            email=decoded.get("email"),
            role=decoded.get("role", "user"),
            firebase_uid=decoded["uid"],
        )
    except Exception:
        return None


def verify_firebase_token_payload(token: str) -> Optional[AuthenticatedUser]:
    """
    Fallback: decode Firebase JWT payload WITHOUT signature verification.

    Firebase tokens are RS256-signed by Google. Without the Admin SDK service
    account we can't verify the signature, but we can safely read the payload
    for a hackathon/demo where all traffic is trusted (localhost / LAN).

    In production: use verify_firebase_token() with a real service account.
    """
    try:
        payload = jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_exp": False,   # also skip expiry check in dev
            },
            algorithms=["RS256", "HS256"],
        )
        uid = payload.get("sub") or payload.get("user_id")
        if not uid:
            return None

        # Sanity-check it looks like a Firebase token
        iss = payload.get("iss", "")
        aud = payload.get("aud", "")
        if "securetoken.google.com" not in iss:
            return None  # not a Firebase token — let the next verifier try

        return AuthenticatedUser(
            uid=uid,
            email=payload.get("email"),
            role=payload.get("role", "user"),
            firebase_uid=uid,
        )
    except Exception:
        return None


def verify_jwt_token(token: str) -> Optional[AuthenticatedUser]:
    """Verify our own HS256 JWT (issued by /v2/auth/sync)."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        return AuthenticatedUser(
            uid=payload["sub"],
            email=payload.get("email"),
            role=payload.get("role", "user"),
        )
    except jwt.PyJWTError:
        return None


def resolve_token(token: str) -> Optional[AuthenticatedUser]:
    """
    Try all verification strategies in priority order:
      1. Firebase Admin SDK  (full RS256 verification — needs service account)
      2. Our own HS256 JWT   (issued by /v2/auth/sync)
      3. Firebase payload    (no-sig fallback — dev/hackathon mode)
    """
    user = verify_firebase_token(token)
    if user:
        return user

    user = verify_jwt_token(token)
    if user:
        return user

    user = verify_firebase_token_payload(token)
    if user:
        return user

    return None


def create_jwt_token(uid: str, email: str = None, role: str = "user") -> str:
    payload = {
        "sub": uid,
        "email": email,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ── FastAPI dependencies ──────────────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    user = resolve_token(credentials.credentials)
    if user:
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
    )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[AuthenticatedUser]:
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_provider(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if user.role not in ("provider", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Provider access required"
        )
    return user


def require_admin(
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return user
