"""Creating and launching missions with all guardrails applied (shared by the API and the voice agent)."""
import asyncio

from sqlalchemy.orm import Session

from ..config import settings
from ..guardrails import fallback_reason, ip_missions_today, limits_bypassed, record_usage
from ..guardrails.moderation import Rejected, check_input
from ..models import Mission
from . import pipeline
from .templates import TEMPLATES, validate_inputs


class MissionError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


_tasks: set[asyncio.Task] = set()


def create_mission(db: Session, template_id: str, inputs: dict, ip: str, *, recorded: bool = False) -> tuple[str, bool, str | None]:
    """Returns (mission_id, is_replay, reason). Raises MissionError for bad input only.

    When the visitor's daily runs ("limit") or the site's daily budget ("budget") are used up, the mission is a recorded
    replay instead of an error, so nobody hits a dead end."""
    if template_id not in TEMPLATES:
        raise MissionError(404, "Unknown mission template.")
    if recorded:
        # "Watch a recorded run": no inputs needed, nothing is used up, nobody hits a limit
        rec = pipeline.load_replay(template_id)
        if rec is None:
            raise MissionError(404, "No recorded run is available for this template yet.")
        mid = pipeline.new_mission_id()
        db.add(Mission(id=mid, template_id=template_id, inputs=rec["inputs"], status="queued", ip=ip, replay=True))
        db.commit()
        return mid, True, "recorded"
    try:
        clean = validate_inputs(template_id, inputs)
        for value in clean.values():
            if value:
                check_input(value, limit=600)
    except (ValueError, Rejected) as exc:
        raise MissionError(422, str(exc)) from exc

    reason: str | None = None
    if fallback_reason(db) is not None:
        reason = "budget"
    elif ip_missions_today(db, ip) >= settings.ip_missions_per_day and not limits_bypassed(ip):
        reason = "limit"
    replay = reason is not None

    mid = pipeline.new_mission_id()
    db.add(Mission(id=mid, template_id=template_id, inputs=clean, status="queued", ip=ip, replay=replay))
    db.commit()
    if not replay:
        record_usage(db, missions=1)
    return mid, replay, reason


def launch(mission_id: str, replay: bool, reason: str | None = None) -> None:
    coro = pipeline.run_replay(mission_id, reason) if replay else pipeline.run_mission(mission_id)
    task = asyncio.create_task(coro)
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
