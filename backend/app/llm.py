"""Thin LLM layer over Groq (fast steps, voice) and Anthropic (long writing), via plain HTTPS.

Everything degrades to None when the key is missing or the call fails; callers then use their
offline fallback. Token usage is returned so guardrails can enforce the daily budget.
"""
import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

import httpx

from .config import settings

log = logging.getLogger("llm")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# the model that last worked, so a retired default is only discovered once per process
_working_model: str | None = None
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


@dataclass
class LLMResult:
    text: str = ""
    tool_calls: list[dict] = field(default_factory=list)  # [{id, name, arguments: dict}]
    tokens: int = 0  # input + output, what the daily budget counts
    tokens_in: int = 0
    tokens_out: int = 0
    model: str = ""  # "groq:<model>" or "anthropic:<model>", as the provider reported it
    ms: int = 0  # wall-clock time of the call, measured here


def cost_usd(model: str, tokens_in: int, tokens_out: int) -> float | None:
    """Price of one call from PRICES_PER_MTOK (config, since prices change). None when no price is set for the model."""
    price = settings.prices.get(model)
    if not price:
        return None
    return round((tokens_in * price.get("input", 0) + tokens_out * price.get("output", 0)) / 1_000_000, 6)


def groq_available() -> bool:
    return bool(settings.groq_api_key)


def anthropic_available() -> bool:
    return bool(settings.anthropic_api_key)


def groq_models() -> list[str]:
    """The configured chat model first, then the fallbacks, without repeats."""
    names = [settings.groq_chat_model, *[m.strip() for m in settings.groq_chat_fallbacks.split(",") if m.strip()]]
    if _working_model:
        names.insert(0, _working_model)
    return list(dict.fromkeys(names))


async def groq_chat(messages: list[dict], tools: list[dict] | None = None, max_tokens: int = 500,
                    temperature: float = 0.4, force_tool: str | None = None) -> LLMResult | None:
    global _working_model
    if not groq_available():
        return None
    body: dict = {"messages": messages, "max_tokens": max_tokens, "temperature": temperature}
    if tools:
        body["tools"] = [{"type": "function", "function": t} for t in tools]
        body["tool_choice"] = {"type": "function", "function": {"name": force_tool}} if force_tool else "auto"
    data = None
    used = ""
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for model in groq_models():
                r = await client.post(GROQ_URL, json={**body, "model": model},
                                      headers={"Authorization": f"Bearer {settings.groq_api_key}"})
                if r.status_code in (400, 404) and "model" in r.text.lower():
                    log.warning("Groq model %r is not available on this account; trying the next one", model)
                    continue
                r.raise_for_status()
                data = r.json()
                if model != settings.groq_chat_model and _working_model != model:
                    log.warning("Using fallback Groq model %r. Set GROQ_CHAT_MODEL to it to silence this.", model)
                _working_model = model
                used = model
                break
    except (httpx.HTTPError, ValueError):
        return None
    if data is None:
        return None
    msg = data["choices"][0]["message"]
    calls = []
    for tc in msg.get("tool_calls") or []:
        try:
            args = json.loads(tc["function"].get("arguments") or "{}")
        except ValueError:
            args = {}
        calls.append({"id": tc["id"], "name": tc["function"]["name"], "arguments": args})
    u = data.get("usage", {})
    return LLMResult(text=msg.get("content") or "", tool_calls=calls, tokens=u.get("total_tokens", 0),
                     tokens_in=u.get("prompt_tokens", 0), tokens_out=u.get("completion_tokens", 0),
                     model=f"groq:{data.get('model') or used}", ms=round((time.perf_counter() - started) * 1000))


@dataclass
class StreamChunk:
    """One piece of a streamed Groq reply: text as it arrives, then tool calls and usage once it ends."""
    type: str  # "text" | "end"
    text: str = ""
    result: LLMResult | None = None  # on "end": the whole reply, with tool calls and token usage


async def groq_stream(messages: list[dict], tools: list[dict] | None = None, max_tokens: int = 500,
                      temperature: float = 0.4) -> AsyncIterator[StreamChunk]:
    """Like groq_chat, but yields the reply's text as Groq produces it. Yields nothing if the call fails before any
    text arrives (the caller then falls back); a failure mid-reply ends the stream with what arrived so far."""
    global _working_model
    if not groq_available():
        return
    body: dict = {"messages": messages, "max_tokens": max_tokens, "temperature": temperature, "stream": True,
                  "stream_options": {"include_usage": True}}
    if tools:
        body["tools"] = [{"type": "function", "function": t} for t in tools]
        body["tool_choice"] = "auto"
    started = time.perf_counter()
    text, calls, usage, used = "", {}, {}, ""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for model in groq_models():
                async with client.stream("POST", GROQ_URL, json={**body, "model": model},
                                         headers={"Authorization": f"Bearer {settings.groq_api_key}"}) as r:
                    if r.status_code in (400, 404):
                        detail = (await r.aread()).decode(errors="ignore")
                        if "model" in detail.lower():
                            log.warning("Groq model %r is not available on this account; trying the next one", model)
                            continue
                    r.raise_for_status()
                    _working_model = used = model
                    async for line in r.aiter_lines():
                        if not line.startswith("data: ") or line == "data: [DONE]":
                            continue
                        data = json.loads(line[6:])
                        usage = data.get("usage") or (data.get("x_groq") or {}).get("usage") or usage
                        for choice in data.get("choices") or []:
                            delta = choice.get("delta") or {}
                            if delta.get("content"):
                                text += delta["content"]
                                yield StreamChunk("text", delta["content"])
                            for tc in delta.get("tool_calls") or []:
                                c = calls.setdefault(tc.get("index", 0), {"id": "", "name": "", "args": ""})
                                c["id"] = tc.get("id") or c["id"]
                                fn = tc.get("function") or {}
                                c["name"] += fn.get("name") or ""
                                c["args"] += fn.get("arguments") or ""
                    break
    except (httpx.HTTPError, ValueError):
        if not text and not calls:
            return
    if not used:
        return
    tool_calls = []
    for c in calls.values():
        try:
            args = json.loads(c["args"] or "{}")
        except ValueError:
            args = {}
        tool_calls.append({"id": c["id"], "name": c["name"], "arguments": args})
    yield StreamChunk("end", result=LLMResult(
        text=text, tool_calls=tool_calls, tokens=usage.get("total_tokens", 0), tokens_in=usage.get("prompt_tokens", 0),
        tokens_out=usage.get("completion_tokens", 0), model=f"groq:{used}",
        ms=round((time.perf_counter() - started) * 1000)))


async def claude_write(system: str, prompt: str, max_tokens: int = 1800) -> LLMResult | None:
    if not anthropic_available():
        return None
    body = {"model": settings.anthropic_model, "max_tokens": max_tokens, "system": system,
            "messages": [{"role": "user", "content": prompt}]}
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(ANTHROPIC_URL, json=body, headers={
                "x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01"})
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    u = data.get("usage", {})
    return LLMResult(text=text, tokens=u.get("input_tokens", 0) + u.get("output_tokens", 0),
                     tokens_in=u.get("input_tokens", 0), tokens_out=u.get("output_tokens", 0),
                     model=f"anthropic:{data.get('model') or settings.anthropic_model}",
                     ms=round((time.perf_counter() - started) * 1000))


async def fast_text(system: str, prompt: str, max_tokens: int = 400) -> LLMResult | None:
    """Groq for short agent steps; falls back to Claude if only that key exists."""
    r = await groq_chat([{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                        max_tokens=max_tokens)
    if r is None and anthropic_available():
        r = await claude_write(system, prompt, max_tokens=max_tokens)
    return r


async def long_text(system: str, prompt: str, max_tokens: int = 1800) -> LLMResult | None:
    """Claude for long writing; falls back to Groq if only that key exists."""
    r = await claude_write(system, prompt, max_tokens=max_tokens)
    if r is None and groq_available():
        r = await groq_chat([{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                            max_tokens=max_tokens, temperature=0.5)
    return r
