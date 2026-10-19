"""Nightly self-evolution: fetch → draft (pending) → human approval → publish + re-embed."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..brain import reindex
from ..guardrails import record_usage
from ..models import AppState, Changelog, EvolutionDraft, Project
from . import drafts as drafts_mod
from . import github


def _get(db: Session, key: str) -> dict:
    row = db.get(AppState, key)
    return dict(row.value) if row else {}


def _put(db: Session, key: str, value: dict) -> None:
    row = db.get(AppState, key)
    if row:
        row.value = value
    else:
        db.add(AppState(key=key, value=value))
    db.commit()


def _parse(ts: str | None):
    return datetime.fromisoformat(ts) if ts else None


async def run(db: Session, fetch=github.fetch_activity) -> dict:
    """One nightly run. `fetch` is injectable for tests."""
    state = _get(db, "evolution_run")
    since = _parse(state.get("last_run"))
    activity = await fetch(since)
    now = datetime.now(timezone.utc)
    created, tokens = 0, 0
    for a in activity:
        dtype, project_id = drafts_mod.classify(db, a)
        content, used = await drafts_mod.write_draft(db, dtype, project_id, a)
        tokens += used
        db.add(EvolutionDraft(repo=a["repo"], commit_range=f"{a['commits'][-1]['sha']}..{a['commits'][0]['sha']}",
                              draft_type=dtype, content=content, status="pending"))
        created += 1
    db.commit()
    _put(db, "evolution_run", {"last_run": now.isoformat(), "drafts_created": created})
    if tokens:
        record_usage(db, tokens=tokens)
    return {"drafts_created": created, "repos_seen": len(activity)}


def pending(db: Session) -> list[EvolutionDraft]:
    return list(db.scalars(select(EvolutionDraft).order_by(EvolutionDraft.created_at.desc())))


def approve(db: Session, draft_id: int, edited: dict | None = None) -> EvolutionDraft:
    d = db.get(EvolutionDraft, draft_id)
    if d is None:
        raise LookupError("draft not found")
    if d.status != "pending":
        raise ValueError(f"draft already {d.status}")
    c = edited if edited is not None else d.content
    if d.draft_type == "new_project":
        p = c.get("project") or {}
        if not p.get("id") or not p.get("name"):
            raise ValueError("new_project draft needs project.id and project.name")
        if db.get(Project, p["id"]) is not None:
            raise ValueError("a project with that id already exists")
        db.add(Project(id=p["id"], name=p["name"], context=p.get("context", ""), role=p.get("role", ""),
                       goal=p.get("goal", ""), result=p.get("result", ""), stack=p.get("stack", []),
                       repo_url=p.get("repo_url"), status="published"))
    elif d.draft_type == "project_update":
        proj = db.get(Project, c.get("project_id") or "")
        if proj is not None and c.get("result"):
            proj.result = c["result"]
    entry = (c.get("changelog") or "").strip()
    if entry:
        db.add(Changelog(entry=entry))
    d.content = c
    d.status = "approved"
    db.commit()
    reindex(db)
    now = datetime.now(timezone.utc)
    ev = _get(db, "evolved")
    # approvals within 12 hours of each other count as one batch on the badge
    carried = ev.get("commits", 0) if ev.get("at") and now - _parse(ev["at"]) < timedelta(hours=12) else 0
    _put(db, "evolved", {"at": now.isoformat(), "commits": carried + int(c.get("commit_count", 0)),
                         "latest_commit": c.get("latest_commit", ev.get("latest_commit", "")),
                         "repo": d.repo})
    return d


def reject(db: Session, draft_id: int) -> EvolutionDraft:
    d = db.get(EvolutionDraft, draft_id)
    if d is None:
        raise LookupError("draft not found")
    if d.status != "pending":
        raise ValueError(f"draft already {d.status}")
    d.status = "rejected"
    db.commit()
    return d


def status(db: Session) -> dict:
    ev = _get(db, "evolved")
    last_run = _get(db, "evolution_run").get("last_run")  # None until the nightly job has actually run
    if not ev:
        # never evolved: say so rather than faking a timestamp
        return {"last_evolved_at": None, "last_run_at": last_run, "commits_learned": 0, "latest_commit": None, "repo": None}
    return {"last_evolved_at": ev["at"], "last_run_at": last_run, "commits_learned": ev.get("commits", 0),
            "latest_commit": ev.get("latest_commit"), "repo": ev.get("repo")}
