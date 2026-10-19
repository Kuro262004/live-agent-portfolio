"""Automatic deletion, so the privacy page's promise is true without anyone remembering to clean up.

Missions (the typed details, the log, the deliverable, shared links) and call records (which hold an IP address)
are deleted once they are older than RETENTION_DAYS. Daily usage totals hold no personal data and are kept.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from .config import settings
from .database import SessionLocal
from .models import CallSession, Mission, MissionEvent

log = logging.getLogger("retention")
DAY_SECONDS = 24 * 3600


def purge(db, days: int | None = None, now: datetime | None = None) -> dict:
    """Delete missions, their events and call records older than `days`. Returns how many of each were removed."""
    days = settings.retention_days if days is None else days
    if days <= 0:
        return {"missions": 0, "events": 0, "calls": 0}
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=days)
    old_ids = list(db.scalars(select(Mission.id).where(Mission.created_at < cutoff)))
    events = missions = 0
    if old_ids:
        events = db.execute(delete(MissionEvent).where(MissionEvent.mission_id.in_(old_ids))).rowcount
        missions = db.execute(delete(Mission).where(Mission.id.in_(old_ids))).rowcount
    calls = db.execute(delete(CallSession).where(CallSession.started_at < cutoff)).rowcount
    db.commit()
    return {"missions": missions, "events": events, "calls": calls}


async def retention_loop() -> None:
    """Run the purge now and then once a day, for as long as the server is up."""
    while True:
        try:
            with SessionLocal() as db:
                removed = purge(db)
            if any(removed.values()):
                log.info("retention purge removed %s", removed)
        except Exception:  # never let cleanup take the server down
            log.exception("retention purge failed")
        await asyncio.sleep(DAY_SECONDS)
