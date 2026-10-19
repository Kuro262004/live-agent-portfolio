from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import CallSession, Mission, MissionEvent, UsageBudget
from app.retention import purge

NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)


def _mission(db, mid, age_days, ip="1.2.3.4"):
    db.add(Mission(id=mid, template_id="t", inputs={"business": "Private Cafe"}, status="complete", ip=ip,
                   created_at=NOW - timedelta(days=age_days)))
    db.add(MissionEvent(mission_id=mid, seq=1, agent="planner", type="step_started", message="x",
                        created_at=NOW - timedelta(days=age_days)))


def test_purge_deletes_old_missions_events_and_calls_but_keeps_recent_ones():
    with SessionLocal() as db:
        _mission(db, "old1", 31)
        _mission(db, "new1", 2)
        db.add(CallSession(ip="9.9.9.9", started_at=NOW - timedelta(days=45)))
        db.add(CallSession(ip="8.8.8.8", started_at=NOW - timedelta(days=1)))
        db.commit()

        removed = purge(db, days=30, now=NOW)

        assert removed == {"missions": 1, "events": 1, "calls": 1}
        assert db.get(Mission, "old1") is None
        assert db.get(Mission, "new1") is not None
        assert db.query(MissionEvent).count() == 1
        assert [c.ip for c in db.query(CallSession)] == ["8.8.8.8"]


def test_zero_days_keeps_everything_and_usage_totals_are_never_touched():
    with SessionLocal() as db:
        _mission(db, "ancient", 400)
        db.add(UsageBudget(date=(NOW - timedelta(days=400)).date(), missions_run=5))
        db.commit()

        assert purge(db, days=0, now=NOW) == {"missions": 0, "events": 0, "calls": 0}
        assert db.get(Mission, "ancient") is not None

        purge(db, days=30, now=NOW)
        assert db.get(Mission, "ancient") is None
        assert db.query(UsageBudget).count() == 1  # aggregate counters hold no personal data
