"""Planner → Researcher → Builder → Reviewer. One revision at most."""
import asyncio
import json
import re
import time
import uuid
from datetime import datetime
from pathlib import Path

from ..brain import search
from ..config import settings
from ..database import SessionLocal
from ..guardrails import record_usage
from ..llm import anthropic_available, fast_text, groq_available, long_text
from ..models import Mission
from . import offline
from .events import Emitter
from .templates import TEMPLATES
from .trace import make_span, now

PACE = 0.8  # seconds between visible steps, so the graph reads as work (tests set this to 0)
REPLAY_DIR = Path(__file__).resolve().parents[3] / "content" / "replays"


def llm_enabled() -> bool:
    return groq_available() or anthropic_available()


def new_mission_id() -> str:
    return "m_" + uuid.uuid4().hex[:10]


async def _pause(factor: float = 1.0) -> None:
    if PACE:
        await asyncio.sleep(PACE * factor)


def _set(mission_id: str, **fields) -> None:
    with SessionLocal() as db:
        m = db.get(Mission, mission_id)
        for k, v in fields.items():
            setattr(m, k, v)
        db.commit()


async def run_mission(mission_id: str) -> None:
    with SessionLocal() as db:
        m = db.get(Mission, mission_id)
        template_id, inputs = m.template_id, dict(m.inputs)
    t = TEMPLATES[template_id]
    em = Emitter(mission_id)
    tokens = 0
    _set(mission_id, status="running")
    try:
        # ---- Planner
        em.emit("planner", "step_started", "Breaking the task into steps")
        started = now()
        await _pause()
        plan = list(offline.PLAN_STEPS[template_id])
        system = "You are the Planner agent. Reply with exactly 4 short imperative steps, one per line, no numbering."
        prompt = f"Task: {t['title']}\nDeliverable: {t['deliverable']}\nVisitor input: {json.dumps(inputs)}"
        used = None
        if llm_enabled():
            r = await fast_text(system, prompt)
            if r and r.text:
                tokens += r.tokens
                lines = [re.sub(r"^[\-\d\.\)\s•*]+", "", ln).strip() for ln in r.text.splitlines() if ln.strip()]
                if len(lines) >= 3:
                    plan = lines[:5]
                    used = r
        em.emit("planner", "step_progress", f"{len(plan)} steps: " + "; ".join(plan))
        em.emit("planner", "step_done", "Plan ready")
        em.emit_span(make_span(
            "planner", started, input=prompt, prompt_template=f"planner/v1\nsystem: {system}\nuser: {prompt}",
            output="\n".join(plan), result=used, model="offline plan template (no AI key)"))
        em.emit("planner", "handoff", "Handing the plan to the Researcher")
        await _pause(0.6)

        # ---- Researcher
        em.emit("researcher", "step_started", "Checking past project patterns in the shared brain")
        started = now()
        searching = 0.0
        findings: list[dict] = []
        seen = set()
        with SessionLocal() as db:
            for q in t["queries"]:
                await _pause(0.6)
                t0 = time.perf_counter()
                hits = [h for h in search(db, q, k=2) if h["score"] >= 0.2]
                searching += time.perf_counter() - t0
                names = []
                for h in hits:
                    key = (h["source"], h["source_id"])
                    if key not in seen:
                        seen.add(key)
                        findings.append(h)
                        names.append(f"{h['source']}/{h['source_id']}")
                em.emit("researcher", "step_progress", f"“{q[:48]}” → {', '.join(names) or 'nothing new'}")
        em.emit("researcher", "step_done", f"{len(findings)} relevant patterns found")
        em.emit_span(make_span(
            "researcher", started, input="\n".join(t["queries"]),
            prompt_template="researcher/v1: one shared-brain search per query, top 2 hits with score ≥ 0.2\nqueries:\n- "
            + "\n- ".join(t["queries"]),
            output=f"{len(findings)} relevant patterns: " + ", ".join(f"{f['source']}/{f['source_id']}" for f in findings),
            retrieved=findings, model="shared brain (local hashed embeddings + keyword boost)",
            latency_ms=round(searching * 1000), local=True))
        em.emit("researcher", "handoff", "Handing findings to the Builder")
        await _pause(0.6)

        # ---- Builder (+ one revision)
        markdown = ""
        problems: list[str] = []
        for attempt in (1, 2):
            em.emit("builder", "step_started",
                    "Writing the deliverable" if attempt == 1 else "Revising after the Reviewer's notes")
            started = now()
            await _pause()
            markdown = ""
            system, prompt = _build_prompt(t, inputs, plan, findings, problems)
            used = None
            if llm_enabled():
                markdown, used = await _llm_build(system, prompt)
                if used:
                    tokens += used.tokens
            t0 = time.perf_counter()
            if not markdown:
                markdown = offline.compose(template_id, inputs, findings, plan)
            em.emit("builder", "step_done", f"Draft {attempt} written ({len(markdown.split())} words)")
            em.emit_span(make_span(
                "builder", started, input=prompt, prompt_template=f"builder/v1\nsystem: {system}\nuser: {prompt}",
                output=markdown, result=used, model="offline deliverable template (no AI key)",
                latency_ms=round((time.perf_counter() - t0) * 1000)))
            em.emit("builder", "handoff", "Handing the draft to the Reviewer")
            await _pause(0.6)

            # ---- Reviewer
            em.emit("reviewer", "step_started", "Checking quality and scope")
            started = now()
            await _pause()
            t0 = time.perf_counter()
            problems = offline.review(template_id, markdown, t["sections"], inputs)
            checked = round((time.perf_counter() - t0) * 1000)
            verdict = "Approved: all sections present and on scope" if not problems else "Notes: " + "; ".join(problems)
            if not problems:
                em.emit("reviewer", "step_done", "Approved: all sections present and on scope")
            elif attempt == 1:
                em.emit("reviewer", "step_progress", "Needs one revision: " + "; ".join(problems))
            else:
                em.emit("reviewer", "step_done", "Accepted after one revision (remaining notes: " + "; ".join(problems) + ")")
            # every span follows the line that reports its result, so the log can pair them
            em.emit_span(make_span(
                "reviewer", started, input=f"Draft {attempt} ({len(markdown.split())} words)",
                prompt_template="reviewer/v1: rule-based checks\n- every required section present: "
                + ", ".join(t["sections"]) + "\n- stays on the visitor's business and inputs",
                output=verdict, model="rule-based reviewer (no model call)", latency_ms=checked, local=True))
            if not problems:
                break
            if attempt == 1:
                em.emit("reviewer", "handoff", "Sending back to the Builder")

        result = {"title": t["title"], "markdown": markdown, "template_id": template_id}
        _set(mission_id, status="complete", result=result, cost=float(tokens))
        em.emit("reviewer", "complete", "Mission complete: deliverable ready")
        with SessionLocal() as db:
            record_usage(db, tokens=tokens)
    except Exception as exc:  # surface a clean error to the graph, keep the server alive
        _set(mission_id, status="error")
        em.emit("planner", "error", f"Mission failed: {type(exc).__name__}")
        raise


def _build_prompt(t: dict, inputs: dict, plan: list[str], findings: list[dict], problems: list[str]) -> tuple[str, str]:
    system = (
        "You are the Builder agent for Justin H. Sales's portfolio demo. Write a practical, concrete deliverable in "
        "Markdown for the visitor's business. Use ONLY these H2 headings, in order: "
        + ", ".join(t["sections"]) + ". Under 'Patterns from past work' cite only the supplied findings. "
        "Never invent clients, metrics or results. Be concise."
    )
    prompt = (
        f"Task: {t['title']}\nVisitor input: {json.dumps(inputs)}\nPlan:\n- " + "\n- ".join(plan)
        + "\nFindings from Justin's past work:\n" + "\n".join(f"- {f['content']}" for f in findings)
    )
    if problems:
        prompt += "\nReviewer notes to fix: " + "; ".join(problems)
    return system, prompt


async def _llm_build(system: str, prompt: str):
    r = await long_text(system, prompt)
    if r is None or not r.text.strip():
        return "", None
    return r.text.strip(), r


# ---- Recorded replays (fallback mode) --------------------------------------------------------

def load_replay(template_id: str) -> dict | None:
    p = REPLAY_DIR / f"{template_id}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


async def run_replay(mission_id: str, reason: str | None = None) -> None:
    """Re-emit a recorded mission's events with their original ordering and pacing."""
    with SessionLocal() as db:
        template_id = db.get(Mission, mission_id).template_id
    rec = load_replay(template_id)
    em = Emitter(mission_id)
    _set(mission_id, status="running")
    if rec is None:
        _set(mission_id, status="error")
        em.emit("planner", "error", "No recorded replay is available for this template yet.")
        return
    if reason == "recorded":
        em.emit("planner", "step_started", "Replaying a recorded run of this template")
    else:
        why = "Daily limit reached" if reason == "limit" else "Budget reached"
        em.emit("planner", "step_started", f"{why}: showing a recorded run instead of a live one")
    started: dict[str, datetime] = {}
    for ev in rec["events"]:
        if ev["type"] == "span":
            # recorded spans keep their content and metrics; their times follow this replay, and the mode says so
            span = {**ev["span"], "mode": "recorded", "recorded_mode": ev["span"].get("mode"),
                    "started_at": started.get(ev["agent"], now()).isoformat(), "ended_at": now().isoformat()}
            em.emit_span(span)
            continue
        await _pause(0.7)
        if ev["type"] == "step_started":
            started[ev["agent"]] = now()
        em.emit(ev["agent"], ev["type"], ev["message"])
    _set(mission_id, status="complete", result=rec["result"])
