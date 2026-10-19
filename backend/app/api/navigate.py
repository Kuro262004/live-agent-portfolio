"""Ask-to-navigate: a plain-language palette question ("show me his backend work") becomes a section to scroll to,
cards to highlight and one short sentence. The model is forced to answer through the `navigate` tool, and every
highlight is checked against the real ids. Without a live model this answers {"fallback": true} and the browser
uses its own keyword map instead.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..guardrails import fallback_reason, record_usage
from ..guardrails.moderation import Rejected, check_input, clean_output
from ..llm import groq_available, groq_chat
from ..models import Experience, Project, Skill
from .deps import SlidingLimiter, client_ip

router = APIRouter(prefix="/api")
limiter = SlidingLimiter(limit=settings.ip_navigate_per_day, window_s=86_400)

SECTIONS = ["mission", "about", "skills", "experience", "projects", "bestiary", "hire", "contact"]
NAV_TOOL = {
    "name": "navigate",
    "description": "Move the visitor to the most relevant part of Justin's portfolio.",
    "parameters": {
        "type": "object",
        "properties": {
            "section": {"type": "string", "enum": SECTIONS},
            "highlight": {"type": "array", "items": {"type": "string"},
                          "description": "ids of cards to highlight, exactly as listed in the index"},
            "say": {"type": "string", "description": "one short sentence shown to the visitor"},
        },
        "required": ["section", "say"],
    },
}


class NavIn(BaseModel):
    q: str = Field(max_length=300)


def portfolio_index(db: Session) -> dict[str, str]:
    """Highlightable cards: id → what it is. Ids are "<section>:<id>" and match data-nav-id on the page."""
    index = {f"projects:{p.id}": p.name for p in db.scalars(select(Project).where(Project.status == "published"))}
    index |= {f"experience:{e.id}": f"{e.title} ({e.org})" for e in db.scalars(select(Experience))}
    modules: dict[str, list[str]] = {}
    for s in db.scalars(select(Skill).order_by(Skill.sort_order)):
        modules.setdefault(s.module, []).append(s.name)
    index |= {f"skills:{m}": f"{m} skills: " + ", ".join(names[:8]) for m, names in modules.items()}
    return index


@router.post("/navigate")
async def navigate(body: NavIn, request: Request, db: Session = Depends(get_db)):
    try:
        q = check_input(body.q, limit=200)
    except Rejected as exc:
        raise HTTPException(422, str(exc))
    if not groq_available() or fallback_reason(db) is not None:
        return {"fallback": True}
    if not limiter.allow(client_ip(request)):
        return {"fallback": True}  # the keyword map still works; it just isn't the model
    index = portfolio_index(db)
    system = ("You route visitors around Justin H. Sales's portfolio. Pick the single best section and up to 3 cards "
              "from this index (use the ids exactly):\n" + "\n".join(f"- {k}: {v}" for k, v in index.items())
              + "\nSections: " + ", ".join(SECTIONS) + ". Keep `say` under 20 words and never invent facts.")
    r = await groq_chat([{"role": "system", "content": system}, {"role": "user", "content": q}],
                        tools=[NAV_TOOL], force_tool="navigate", max_tokens=200, temperature=0.2)
    if r is None or not r.tool_calls:
        return {"fallback": True}
    record_usage(db, tokens=r.tokens)
    args = r.tool_calls[0]["arguments"]
    section = args.get("section") if args.get("section") in SECTIONS else None
    if section is None:
        return {"fallback": True}
    highlight = [h for h in args.get("highlight") or [] if h in index][:3]
    return {"section": section, "highlight": highlight, "say": clean_output(str(args.get("say", "")))[:200],
            "model": r.model}
