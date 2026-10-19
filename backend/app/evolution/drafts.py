"""Turn commit activity into DRAFT updates. Drafts never go live without approval and must not
claim anything the commits don't show (no invented metrics)."""
import json
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..llm import anthropic_available, groq_available, long_text
from ..models import Project


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def classify(db: Session, activity: dict) -> tuple[str, str | None]:
    """(draft_type, project_id or None)."""
    url = activity["url"].lower()
    for p in db.scalars(select(Project)):
        if p.repo_url and p.repo_url.lower().rstrip("/") == url.rstrip("/"):
            return "project_update", p.id
    if len(activity["commits"]) >= 3:
        return "new_project", None
    return "changelog_entry", None


def offline_draft(draft_type: str, project_id: str | None, a: dict) -> dict:
    n = len(a["commits"])
    last = a["commits"][0]["message"]
    plural = "commit" if n == 1 else "commits"
    changelog = f"{n} new {plural} in {a['repo']}: latest — {last}"
    base = {"commit_count": n, "latest_commit": last, "changelog": changelog,
            "commits": [c["message"] for c in a["commits"][:10]]}
    if draft_type == "new_project":
        stack = [x for x in [a["language"], *a["topics"]] if x][:8]
        return {**base, "project": {
            "id": _slug(a["repo"]), "name": a["repo"], "context": "Personal project (GitHub)", "role": "Developer",
            "goal": a["description"] or "(add a one-line goal before approving)",
            "result": f"{n} {plural} so far; latest: {last}", "stack": stack, "repo_url": a["url"]}}
    if draft_type == "project_update":
        return {**base, "project_id": project_id, "result": None}
    return base


async def write_draft(db: Session, draft_type: str, project_id: str | None, a: dict) -> tuple[dict, int]:
    """Returns (content, tokens). Uses Claude when available, else the factual offline draft."""
    fallback = offline_draft(draft_type, project_id, a)
    if not (anthropic_available() or groq_available()):
        return fallback, 0
    system = (
        "You write draft portfolio updates from git commit messages. Use ONLY facts present in the input. "
        "Do not invent metrics, users, clients or outcomes. Plain, modest wording. "
        'Reply with JSON only: {"changelog": "one sentence", "goal": "one sentence", "result": "one sentence"}.'
    )
    prompt = json.dumps({"repo": a["repo"], "description": a["description"], "language": a["language"],
                         "topics": a["topics"], "commit_messages": [c["message"] for c in a["commits"]]})
    r = await long_text(system, prompt, max_tokens=500)
    if r is None:
        return fallback, 0
    m = re.search(r"\{.*\}", r.text, re.S)
    try:
        data = json.loads(m.group(0)) if m else {}
    except ValueError:
        return fallback, r.tokens
    if isinstance(data.get("changelog"), str) and data["changelog"].strip():
        fallback["changelog"] = data["changelog"].strip()[:300]
    if draft_type == "new_project":
        for k in ("goal", "result"):
            if isinstance(data.get(k), str) and data[k].strip():
                fallback["project"][k] = data[k].strip()[:400]
    elif draft_type == "project_update" and isinstance(data.get("result"), str) and data["result"].strip():
        fallback["result"] = data["result"].strip()[:400]
    return fallback, r.tokens
