"""One phone call with Justin's AI over a WebSocket.

Client → server:  binary = 16 kHz mono PCM16 mic audio; JSON {type: start|text|barge_in|end|ping}
Server → client:  JSON {ready|transcript|reply|narration|ui|interrupt|audio_start|audio_end|wrapup|ended|error}
                  and binary MP3 frames between audio_start / audio_end.

Without Groq/Fish keys the server reports stt/tts = false and the browser uses its own speech
recognition and synthesis, sending recognised text as {type: "text"}.
"""
import asyncio
import contextlib
import time
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect

from ..agents import assistant
from ..agents.events import backlog, hub
from ..agents.service import MissionError, create_mission, launch
from ..config import settings
from ..database import SessionLocal
from ..guardrails import fallback_reason, ip_calls_today, limits_bypassed, record_usage
from ..guardrails import captcha
from ..guardrails.moderation import Rejected, check_input
from ..models import CallSession
from . import stt, tts
from .vad import Vad

GREETING = ("Hi, I'm Justin's AI assistant, not Justin himself. I can tell you about his work, "
            "or you can give my agents a small task and watch them build it. What would you like?")
WRAPUP = "We're almost out of time, so one last question, or I can show you how to book a call with the real Justin."
GOODBYE = "That's the end of our time. Thanks for calling. You can book a call with the real Justin any time. Goodbye!"


class Call:
    def __init__(self, ws: WebSocket, ip: str) -> None:
        self.ws = ws
        self.ip = ip
        self.vad = Vad()
        self.history: list[dict] = []
        self.speech_lock = asyncio.Lock()
        self.speech_task: asyncio.Task | None = None
        self.tasks: set[asyncio.Task] = set()
        self.use_voice_in = False
        self.use_voice_out = False
        self.use_llm = True
        self.language = "English"
        self.tokens = 0
        self.tts_chars = 0
        self.started = time.monotonic()
        self.outcome = "ended"
        self.closed = False
        self.session_id: int | None = None

    # ---- sending -----------------------------------------------------------------------
    async def send(self, **msg) -> None:
        if not self.closed:
            with contextlib.suppress(RuntimeError, WebSocketDisconnect):
                await self.ws.send_json(msg)

    async def speak(self, text: str, kind: str = "reply") -> None:
        """Send text (and audio when server TTS is on). Cancellable: barge-in cancels it."""
        async with self.speech_lock:
            await self.send(type=kind, text=text)
            if not self.use_voice_out:
                return
            await self.send(type="audio_start")
            try:
                for sentence in tts.split_sentences(text):
                    self.tts_chars += len(sentence)
                    buf = b""
                    async for chunk in tts.synth_stream(sentence):
                        buf += chunk
                    if buf and not self.closed:
                        await self.ws.send_bytes(buf)
            finally:
                await self.send(type="audio_end")

    def run_speech(self, coro) -> None:
        self.speech_task = asyncio.create_task(coro)

    async def interrupt(self) -> None:
        t = self.speech_task
        if t and not t.done():
            t.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await t
            await self.send(type="interrupt")

    # ---- the conversation --------------------------------------------------------------
    async def user_said(self, text: str) -> None:
        try:
            text = check_input(text, limit=400)
        except Rejected as exc:
            self.run_speech(self.speak(str(exc)))
            return
        await self.send(type="transcript", text=text)
        hooks = assistant.Hooks(start_mission=self._start_mission, narrate=self._narrate, on_tool=self._on_tool)
        with SessionLocal() as db:
            res = await assistant.turn(db, self.history, text, hooks, use_llm=self.use_llm, language=self.language)
        self.tokens += res.tokens
        self.history += [{"role": "user", "content": text}, {"role": "assistant", "content": res.text}]
        for act in res.actions:
            await self.send(type="ui", action=act)
        self.run_speech(self.speak(res.text))
        if res.end:
            self.outcome = "visitor_ended"
            await self._finish()

    async def _on_tool(self, name: str, args: dict) -> None:
        await self.send(type="tool", name=name)  # the browser lights the matching edge; arguments stay here

    async def _start_mission(self, template_id: str, inputs: dict) -> tuple[str, str | None]:
        try:
            with SessionLocal() as db:
                mid, replay, reason = create_mission(db, template_id, inputs, self.ip)
        except MissionError as exc:
            raise ValueError(exc.message) from exc
        launch(mid, replay, reason)
        self._narrate(mid)
        return mid, reason

    def _narrate(self, mission_id: str) -> None:
        if not mission_id:
            return
        t = asyncio.create_task(self._narrator(mission_id))
        self.tasks.add(t)
        t.add_done_callback(self.tasks.discard)

    async def _narrator(self, mission_id: str) -> None:
        q = hub.subscribe(mission_id)
        try:
            for ev in backlog(mission_id):
                q.put_nowait(ev)
            said = 0
            while not self.closed:
                ev = await asyncio.wait_for(q.get(), timeout=120)
                line = narration_for(ev)
                if line and said < 8:
                    said += 1
                    await self.speak(line, kind="narration")
                if ev["type"] in ("complete", "error"):
                    return
        except (asyncio.TimeoutError, asyncio.CancelledError):
            return
        finally:
            hub.unsubscribe(mission_id, q)

    # ---- lifecycle ---------------------------------------------------------------------
    async def _timer(self) -> None:
        try:
            await asyncio.sleep(settings.call_wrapup_seconds)
            self.run_speech(self.speak(WRAPUP, kind="wrapup"))
            await asyncio.sleep(max(settings.max_call_seconds - settings.call_wrapup_seconds, 0))
            self.outcome = "timeout"
            await self.interrupt()
            await self.speak(GOODBYE, kind="reply")
            await self._finish()
        except asyncio.CancelledError:
            return

    async def _finish(self) -> None:
        if self.closed:
            return
        await asyncio.sleep(0.05)
        await self.send(type="ended", outcome=self.outcome)
        self.closed = True
        with contextlib.suppress(Exception):
            await self.ws.close()

    def _save(self) -> None:
        duration = int(time.monotonic() - self.started)
        with SessionLocal() as db:
            row = db.get(CallSession, self.session_id) if self.session_id else None
            if row:
                row.ended_at = datetime.now(timezone.utc)
                row.duration_s = duration
                row.tokens = self.tokens
                row.tts_chars = self.tts_chars
                row.outcome = self.outcome
                db.commit()
            record_usage(db, tokens=self.tokens, voice_seconds=duration if self.use_voice_in else 0,
                         tts_chars=self.tts_chars)

    async def run(self) -> None:
        await self.ws.accept()
        try:
            first = await asyncio.wait_for(self.ws.receive_json(), timeout=15)
        except (asyncio.TimeoutError, WebSocketDisconnect, ValueError, RuntimeError):
            await self.ws.close()
            return
        if first.get("type") != "start":
            await self.send(type="error", message="Expected a start message.")
            await self.ws.close()
            return
        if not await captcha.verify(first.get("captcha"), self.ip):
            await self.send(type="error", code="captcha", message="Please complete the verification and try again.")
            await self.ws.close()
            return

        with SessionLocal() as db:
            reason = fallback_reason(db)
            if reason is None and ip_calls_today(db, self.ip) >= settings.ip_calls_per_day and not limits_bypassed(self.ip):
                await self.send(type="error", code="rate_limit",
                                message=f"Daily limit reached: {settings.ip_calls_per_day} calls per visitor. You can still use the plain view or book a call.")
                await self.ws.close()
                return
            row = CallSession(ip=self.ip)
            db.add(row)
            db.commit()
            self.session_id = row.id

        self.language = first.get("language") if first.get("language") in assistant.LANGUAGES else "English"
        fallback = reason is not None
        self.use_llm = not fallback
        wants_voice = first.get("mode") == "voice" and not fallback
        self.use_voice_in = wants_voice and stt.available()
        self.use_voice_out = wants_voice and tts.available()
        await self.send(type="ready", stt=self.use_voice_in, tts=self.use_voice_out, fallback=fallback,
                        reason=reason, max_seconds=settings.max_call_seconds,
                        wrapup_seconds=settings.call_wrapup_seconds)
        timer = asyncio.create_task(self._timer())
        self.run_speech(self.speak(GREETING))
        try:
            while not self.closed:
                msg = await self.ws.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                if msg.get("bytes") is not None:
                    await self._audio(msg["bytes"])
                elif msg.get("text") is not None:
                    await self._control(msg["text"])
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            timer.cancel()
            for t in list(self.tasks):
                t.cancel()
            if self.speech_task and not self.speech_task.done():
                self.speech_task.cancel()
            self.closed = True
            self._save()

    async def _audio(self, data: bytes) -> None:
        if not self.use_voice_in:
            return
        for kind, pcm in self.vad.feed(data):
            if kind == "start":
                await self.interrupt()  # barge-in: stop talking the moment the visitor speaks
            elif kind == "end" and pcm:
                text = await stt.transcribe(pcm)  # audio is discarded right after this
                if text:
                    await self.user_said(text)

    async def _control(self, raw: str) -> None:
        import json
        try:
            msg = json.loads(raw)
        except ValueError:
            return
        kind = msg.get("type")
        if kind == "text":
            await self.interrupt()
            await self.user_said(str(msg.get("text", "")))
        elif kind == "barge_in":
            await self.interrupt()
        elif kind == "end":
            self.outcome = "visitor_ended"
            await self._finish()
        elif kind == "ping":
            await self.send(type="pong")


def narration_for(ev: dict) -> str | None:
    agent, typ, msg = ev["agent"], ev["type"], ev["message"]
    if typ == "step_done" and agent == "planner":
        return "The planner has broken your task into steps."
    if typ == "step_done" and agent == "researcher":
        return "The researcher found related patterns from Justin's past projects."
    if typ == "step_done" and agent == "builder":
        return "The builder has written a draft."
    if typ == "step_progress" and agent == "reviewer":
        return "The reviewer asked for one revision."
    if typ == "step_done" and agent == "reviewer":
        return "The reviewer approved it."
    if typ == "complete":
        return "All done. Your deliverable is on screen, and you can download it."
    if typ == "error":
        return "Sorry, something went wrong with that mission."
    return None
