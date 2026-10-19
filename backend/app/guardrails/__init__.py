"""Rate limits and daily budget caps with a hard stop and a fallback switch."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import CallSession, Mission, UsageBudget


_LOOPBACK = {"127.0.0.1", "::1", "localhost"}


def limits_bypassed(ip: str) -> bool:
    """True only for this machine while developing; the per-IP limits then don't apply."""
    return (settings.dev_bypass_limits and settings.environment.lower() in ("development", "dev") and ip in _LOOPBACK)


def today():
    return datetime.now(timezone.utc).date()


def _row(db: Session) -> UsageBudget:
    row = db.get(UsageBudget, today())
    if row is None:
        row = UsageBudget(date=today(), llm_tokens=0, voice_seconds=0, tts_chars=0, missions_run=0, limit_hit=False)
        db.add(row)
        db.flush()
    return row


def _start_of_day() -> datetime:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def budget_exhausted(db: Session) -> str | None:
    """Name of the cap that has been hit today, or None."""
    row = _row(db)
    if row.llm_tokens >= settings.daily_token_limit:
        return "llm_tokens"
    if row.voice_seconds >= settings.daily_voice_seconds_limit:
        return "voice_seconds"
    if row.tts_chars >= settings.daily_tts_chars_limit:
        return "tts_chars"
    if row.missions_run >= settings.daily_missions_limit:
        return "missions"
    return None


def record_usage(db: Session, *, tokens: int = 0, voice_seconds: int = 0, tts_chars: int = 0,
                 missions: int = 0) -> None:
    row = _row(db)
    row.llm_tokens += tokens
    row.voice_seconds += voice_seconds
    row.tts_chars += tts_chars
    row.missions_run += missions
    if budget_exhausted(db):
        row.limit_hit = True
    db.commit()


def ip_missions_today(db: Session, ip: str) -> int:
    return db.scalar(select(func.count()).select_from(Mission).where(
        Mission.ip == ip, Mission.replay.is_(False), Mission.created_at >= _start_of_day())) or 0


def ip_calls_today(db: Session, ip: str) -> int:
    return db.scalar(select(func.count()).select_from(CallSession).where(
        CallSession.ip == ip, CallSession.started_at >= _start_of_day())) or 0


def fallback_reason(db: Session) -> str | None:
    """When set, new calls become text chat and new missions replay a recording."""
    return budget_exhausted(db)
