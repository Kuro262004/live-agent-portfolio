"""Trace spans: what each agent did in a mission, for the trace inspector.

A span is sent on the mission event stream as a `span` event and stored with the mission's other events (so it
follows the same retention). It carries the agent's input, the prompt template with its filled variables, what it
retrieved from the shared brain, its output and real metrics. It never carries API keys or visitor IPs, and its
`mode` says whether the numbers are live, scripted (no AI keys) or from a recording.
"""
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel

from ..llm import LLMResult, cost_usd

OUTPUT_LIMIT = 4000  # long deliverables are cut in the span; the full text is the mission result


class Retrieved(BaseModel):
    source: str  # e.g. "experience/aiko"
    score: float
    excerpt: str


class Span(BaseModel):
    span_id: str
    agent: str  # planner | researcher | builder | reviewer
    started_at: datetime
    ended_at: datetime
    input: str
    prompt_template: str  # template name + filled variables, never secrets
    retrieved: list[Retrieved] = []
    output: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0  # the model call itself (or the local work), without the on-screen pacing
    cost_usd: float | None = None  # None: no price configured for this model
    # live: a model answered · local: real work without a model (search, rule checks) · scripted: template text
    # because no AI key is set · recorded: replayed from a saved run (recorded_mode says what it was then)
    mode: str
    recorded_mode: str | None = None


def now() -> datetime:
    return datetime.now(timezone.utc)


def make_span(agent: str, started_at: datetime, *, input: str, prompt_template: str, output: str,
              result: LLMResult | None = None, model: str = "", latency_ms: int = 0,
              retrieved: list[dict] | None = None, local: bool = False) -> dict:
    """A finished span. Pass the LLM result when a model answered (live); otherwise `model` names the step, and
    `local` marks real work that never involves a model (so it isn't labelled scripted)."""
    live = result is not None
    return Span(
        span_id="s_" + uuid.uuid4().hex[:8], agent=agent, started_at=started_at, ended_at=now(), input=input,
        prompt_template=prompt_template, output=output[:OUTPUT_LIMIT] + ("…" if len(output) > OUTPUT_LIMIT else ""),
        retrieved=[Retrieved(source=f"{h['source']}/{h['source_id']}", score=h["score"], excerpt=h["content"][:160])
                   for h in retrieved or []],
        model=result.model if live else model, tokens_in=result.tokens_in if live else 0,
        tokens_out=result.tokens_out if live else 0, latency_ms=result.ms if live else latency_ms,
        cost_usd=cost_usd(result.model, result.tokens_in, result.tokens_out) if live else None,
        mode="live" if live else "local" if local else "scripted",
    ).model_dump(mode="json")
