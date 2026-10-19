"""Mission event bus: persisted (so late subscribers can replay) and fanned out to live subscribers."""
import asyncio
import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from ..database import SessionLocal
from ..models import MissionEvent

PH = timezone(timedelta(hours=8))  # events are stamped +08:00 like the spec example


class Hub:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = {}

    def subscribe(self, mission_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs.setdefault(mission_id, set()).add(q)
        return q

    def unsubscribe(self, mission_id: str, q: asyncio.Queue) -> None:
        self._subs.get(mission_id, set()).discard(q)
        if not self._subs.get(mission_id):
            self._subs.pop(mission_id, None)

    def publish(self, mission_id: str, event: dict) -> None:
        for q in list(self._subs.get(mission_id, ())):
            q.put_nowait(event)


hub = Hub()


def event_dict(e: MissionEvent) -> dict:
    ev = {
        "mission_id": e.mission_id, "seq": e.seq, "agent": e.agent, "type": e.type, "message": e.message,
        "timestamp": e.created_at.astimezone(PH).isoformat(timespec="milliseconds"),
    }
    if e.type == "span":  # the span itself is stored as JSON in the message; send it as a field instead
        ev["span"] = json.loads(e.message)
        ev["message"] = f"{e.agent} trace"
    return ev


def backlog(mission_id: str, after_seq: int = 0) -> list[dict]:
    with SessionLocal() as db:
        rows = db.scalars(select(MissionEvent).where(
            MissionEvent.mission_id == mission_id, MissionEvent.seq > after_seq).order_by(MissionEvent.seq))
        return [event_dict(r) for r in rows]


class Emitter:
    def __init__(self, mission_id: str) -> None:
        self.mission_id = mission_id
        self.seq = 0

    def emit(self, agent: str, type_: str, message: str) -> dict:
        self.seq += 1
        with SessionLocal() as db:
            row = MissionEvent(mission_id=self.mission_id, seq=self.seq, agent=agent, type=type_, message=message,
                               created_at=datetime.now(timezone.utc))
            db.add(row)
            db.commit()
            ev = event_dict(row)
        hub.publish(self.mission_id, ev)
        return ev

    def emit_span(self, span: dict) -> dict:
        """A finished trace span (see trace.py), on the same stream as the visible steps."""
        return self.emit(span["agent"], "span", json.dumps(span, ensure_ascii=False))
