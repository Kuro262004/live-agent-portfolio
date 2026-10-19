import asyncio
import json
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agents import assistant
from ..agents.service import MissionError, create_mission, launch
from ..config import settings
from ..database import SessionLocal, get_db
from ..evolution import status as evolution_status
from ..guardrails import fallback_reason, record_usage
from ..guardrails.moderation import Rejected, check_input
from ..llm import anthropic_available, cost_usd, groq_available
from ..models import Changelog, Education, Experience, Profile, Project, Skill, Training
from ..voice import stt, tts
from .deps import SlidingLimiter, client_ip

router = APIRouter(prefix="/api")
chat_limiter = SlidingLimiter(limit=40, window_s=3600)


@router.get("/health")
def health():
    return {"status": "ok"}


def portfolio(db: Session) -> dict:
    p = db.scalars(select(Profile)).first()
    modules: dict[str, list[str]] = {}
    for s in db.scalars(select(Skill).order_by(Skill.sort_order)):
        modules.setdefault(s.module, []).append(s.name)
    return {
        "profile": {"name": p.name, "title": p.title, "summary": p.summary, "contacts": p.contacts,
                    "now_building": (p.extras or {}).get("now_building", ""),
                    "stats": (p.extras or {}).get("stats", []),
                    "testimonials": (p.extras or {}).get("testimonials", [])} if p else None,
        "skills": [{"module": m, "names": n} for m, n in modules.items()],
        "experience": [
            {"id": e.id, "org": e.org, "title": e.title, "role": e.role, "period": e.period,
             "bullets": e.bullets, "stack": e.stack} for e in db.scalars(select(Experience))],
        "projects": [
            {"id": x.id, "name": x.name, "context": x.context, "role": x.role, "goal": x.goal, "result": x.result,
             "stack": x.stack, "repo_url": x.repo_url} for x in db.scalars(select(Project).where(Project.status == "published"))],
        "education": [
            {"degree": e.degree, "specialization": e.specialization, "school": e.school, "date": e.date}
            for e in db.scalars(select(Education))],
        "trainings": [{"title": t.title, "provider": t.provider, "date": t.date} for t in db.scalars(select(Training))],
        "changelog": [
            {"entry": c.entry, "published_at": c.published_at.isoformat()}
            for c in db.scalars(select(Changelog).order_by(Changelog.published_at.desc()).limit(10))],
    }


@router.get("/profile")
def get_profile(db: Session = Depends(get_db)):
    return portfolio(db)


@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    reason = fallback_reason(db)
    return {
        "fallback": reason is not None, "reason": reason,
        "llm": groq_available() or anthropic_available(),
        "voice": {"stt": stt.available(), "tts": tts.available()},
        "booking_url": settings.booking_url or None,
        "captcha_required": bool(settings.captcha_secret),
        "limits": {"calls_per_day": settings.ip_calls_per_day, "missions_per_day": settings.ip_missions_per_day,
                   "max_call_seconds": settings.max_call_seconds},
    }


@router.get("/evolution/status")
def get_evolution_status(db: Session = Depends(get_db)):
    return evolution_status(db)


class ChatIn(BaseModel):
    message: str = Field(max_length=2000)
    history: list[dict] = Field(default_factory=list, max_length=20)
    language: str = "English"


def _chat_turn_inputs(body: ChatIn, request: Request):
    """Shared checks for both chat endpoints: rate limit, input filter, cleaned history."""
    if not chat_limiter.allow(client_ip(request)):
        raise HTTPException(429, "You're sending messages quickly. Please wait a bit.")
    try:
        text = check_input(body.message, limit=400)
    except Rejected as exc:
        raise HTTPException(422, str(exc))
    history = [
        {"role": h["role"], "content": str(h.get("content", ""))[:600]}
        for h in body.history if h.get("role") in ("user", "assistant")
    ]
    return text, history, client_ip(request)


def _mission_hook(db: Session, ip: str):
    async def start_mission(template_id: str, inputs: dict) -> tuple[str, str | None]:
        try:
            mid, replay, reason = create_mission(db, template_id, inputs, ip)
        except MissionError as exc:
            raise ValueError(exc.message) from exc
        launch(mid, replay, reason)
        return mid, reason

    return start_mission


@router.post("/chat")
async def chat(body: ChatIn, request: Request, db: Session = Depends(get_db)):
    """Text chat with Justin's AI (Phase 1). Same assistant as the voice call."""
    text, history, ip = _chat_turn_inputs(body, request)
    res = await assistant.turn(db, history, text, assistant.Hooks(start_mission=_mission_hook(db, ip)),
                               use_llm=fallback_reason(db) is None, language=body.language)
    if res.tokens:
        record_usage(db, tokens=res.tokens)
    return {"reply": res.text, "actions": res.actions}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat/stream")
async def chat_stream(body: ChatIn, request: Request):
    """The same chat, streamed as Server-Sent Events: `token` (text as the model writes it), `tool` (a tool ran),
    then `done` with the whole reply, UI actions and real metrics. Offline answers arrive as one token."""
    text, history, ip = _chat_turn_inputs(body, request)
    queue: asyncio.Queue = asyncio.Queue()

    async def on_token(t: str) -> None:
        await queue.put(_sse("token", {"t": t}))

    async def on_tool(name: str, args: dict) -> None:
        await queue.put(_sse("tool", {"name": name}))  # the name is enough for the UI; arguments stay on the server

    async def run() -> None:
        started = time.perf_counter()
        streamed = False

        async def first_token(t: str) -> None:
            nonlocal streamed
            streamed = True
            await on_token(t)

        try:
            with SessionLocal() as db:  # its own session: the request's one closes before a stream ends
                res = await assistant.turn(db, history, text, assistant.Hooks(
                    start_mission=_mission_hook(db, ip), on_tool=on_tool, on_token=first_token),
                    use_llm=fallback_reason(db) is None, language=body.language)
                if res.tokens:
                    record_usage(db, tokens=res.tokens)
            if not streamed and res.text:
                await on_token(res.text)
            await queue.put(_sse("done", {
                "reply": res.text, "actions": res.actions, "mode": "live" if res.model else "offline",
                "model": res.model or None, "tokens_in": res.tokens_in, "tokens_out": res.tokens_out,
                "model_ms": res.ms, "ms": round((time.perf_counter() - started) * 1000),
                "cost_usd": cost_usd(res.model, res.tokens_in, res.tokens_out) if res.model else None,
            }))
        except Exception:  # noqa: BLE001 - the stream must always end cleanly for the visitor
            await queue.put(_sse("error", {"detail": "Something went wrong. Please try again."}))
        finally:
            await queue.put(None)

    task = asyncio.create_task(run())

    async def events():
        try:
            while (item := await queue.get()) is not None:
                yield item
        finally:
            if not task.done():
                task.cancel()  # the visitor left mid-reply

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
