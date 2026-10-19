"""Record one mission per template into content/replays/*.json, used when the daily budget is hit.

    python -m app.scripts.record_replays

With GROQ_API_KEY / ANTHROPIC_API_KEY set this records real LLM runs (spec §12: "record one real
mission per template"). Without keys it records the offline agents, which is still a faithful replay
of what the site does without keys; re-run with keys before going public.
"""
import asyncio
import json

from sqlalchemy import delete

from ..agents import pipeline
from ..agents.events import backlog
from ..agents.templates import TEMPLATES
from ..database import SessionLocal
from ..main import migrate
from ..models import Mission, MissionEvent
from ..seed import seed

SAMPLES = {
    "food-ordering-automation": {"business": "Kape Corner, a 20-seat café", "channels": "chat and voice",
                                 "notes": "About 40 menu items and GCash payments"},
    "hotel-self-service": {"business": "40-room boutique hotel", "services": "room service and laundry", "notes": ""},
    "voice-faq-bot": {"business": "Dental clinic", "faqs": "opening hours, prices, booking an appointment",
                      "notes": "Filipino and English callers"},
    "workflow-audit": {"process": "Customer emails an order\nStaff manually copies it into a spreadsheet\n"
                                  "Manager approves by message\nStaff emails the customer a confirmation"},
}


async def record() -> None:
    migrate()
    with SessionLocal() as db:
        seed(db)
    pipeline.PACE = 0
    pipeline.REPLAY_DIR.mkdir(parents=True, exist_ok=True)
    for tid, inputs in SAMPLES.items():
        assert tid in TEMPLATES
        mid = pipeline.new_mission_id()
        with SessionLocal() as db:
            db.add(Mission(id=mid, template_id=tid, inputs=inputs, ip="recorder"))
            db.commit()
        await pipeline.run_mission(mid)
        with SessionLocal() as db:
            m = db.get(Mission, mid)
            result = m.result
        events = [{"agent": e["agent"], "type": e["type"], "message": e["message"], **({"span": e["span"]} if "span" in e else {})}
                  for e in backlog(mid)]
        (pipeline.REPLAY_DIR / f"{tid}.json").write_text(
            json.dumps({"template_id": tid, "inputs": inputs, "events": events, "result": result},
                       indent=2, ensure_ascii=False), encoding="utf-8")
        with SessionLocal() as db:
            db.execute(delete(MissionEvent).where(MissionEvent.mission_id == mid))
            db.execute(delete(Mission).where(Mission.id == mid))
            db.commit()
        print(f"recorded {tid}: {len(events)} events")


if __name__ == "__main__":
    asyncio.run(record())
