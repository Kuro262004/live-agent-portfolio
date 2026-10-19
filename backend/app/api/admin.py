from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import evolution
from ..database import get_db
from ..models import CallSession, EvolutionDraft, UsageBudget
from .deps import require_admin

router = APIRouter()


def _draft(d: EvolutionDraft) -> dict:
    return {"id": d.id, "repo": d.repo, "commit_range": d.commit_range, "draft_type": d.draft_type,
            "content": d.content, "status": d.status, "created_at": d.created_at.isoformat()}


@router.post("/evolve", dependencies=[Depends(require_admin)])
async def evolve(db: Session = Depends(get_db)):
    """Called by the nightly GitHub Actions workflow."""
    return await evolution.run(db)


@router.get("/api/admin/drafts", dependencies=[Depends(require_admin)])
def list_drafts(db: Session = Depends(get_db)):
    return [_draft(d) for d in evolution.pending(db)]


class ApproveIn(BaseModel):
    content: dict | None = None  # edited draft; omit to approve as written


@router.post("/api/admin/drafts/{draft_id}/approve", dependencies=[Depends(require_admin)])
def approve(draft_id: int, body: ApproveIn | None = None, db: Session = Depends(get_db)):
    try:
        return _draft(evolution.approve(db, draft_id, body.content if body else None))
    except LookupError:
        raise HTTPException(404, "Draft not found.")
    except ValueError as exc:
        raise HTTPException(409, str(exc))


@router.post("/api/admin/drafts/{draft_id}/reject", dependencies=[Depends(require_admin)])
def reject(draft_id: int, db: Session = Depends(get_db)):
    try:
        return _draft(evolution.reject(db, draft_id))
    except LookupError:
        raise HTTPException(404, "Draft not found.")
    except ValueError as exc:
        raise HTTPException(409, str(exc))


@router.get("/api/admin/usage", dependencies=[Depends(require_admin)])
def usage(db: Session = Depends(get_db)):
    rows = db.scalars(select(UsageBudget).order_by(UsageBudget.date.desc()).limit(14))
    calls = db.scalars(select(CallSession).order_by(CallSession.started_at.desc()).limit(20))
    return {
        "budget": [{"date": r.date.isoformat(), "llm_tokens": r.llm_tokens, "voice_seconds": r.voice_seconds,
                    "tts_chars": r.tts_chars, "missions_run": r.missions_run, "limit_hit": r.limit_hit} for r in rows],
        "recent_calls": [{"started_at": c.started_at.isoformat(), "duration_s": c.duration_s, "tokens": c.tokens,
                          "tts_chars": c.tts_chars, "outcome": c.outcome} for c in calls],
    }
