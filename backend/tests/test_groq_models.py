import asyncio

import httpx
import pytest

from app import llm
from app.config import settings

REAL_CLIENT = httpx.AsyncClient


@pytest.fixture
def groq(monkeypatch):
    """Groq with a key, and a fake server that only knows the models in `known`."""
    monkeypatch.setattr(settings, "groq_api_key", "test-key")
    monkeypatch.setattr(settings, "groq_chat_model", "retired-model")
    monkeypatch.setattr(llm, "_working_model", None)
    seen: list[str] = []

    def install(known: set[str]):
        def handler(request: httpx.Request) -> httpx.Response:
            import json

            model = json.loads(request.content)["model"]
            seen.append(model)
            if model not in known:
                return httpx.Response(404, json={"error": {"message": f"The model `{model}` does not exist or you do not have access to it."}})
            return httpx.Response(200, json={"choices": [{"message": {"content": "hello"}}], "usage": {"total_tokens": 7}})

        monkeypatch.setattr(llm.httpx, "AsyncClient", lambda **kw: REAL_CLIENT(transport=httpx.MockTransport(handler), **kw))
        return seen

    return install


def test_falls_back_to_the_next_model_when_the_configured_one_is_gone(groq):
    seen = groq({"openai/gpt-oss-120b"})
    result = asyncio.run(llm.groq_chat([{"role": "user", "content": "hi"}]))
    assert result is not None and result.text == "hello" and result.tokens == 7
    assert seen == ["retired-model", "openai/gpt-oss-120b"]


def test_remembers_the_working_model_for_later_calls(groq):
    seen = groq({"openai/gpt-oss-120b"})
    asyncio.run(llm.groq_chat([{"role": "user", "content": "hi"}]))
    seen.clear()
    asyncio.run(llm.groq_chat([{"role": "user", "content": "again"}]))
    assert seen == ["openai/gpt-oss-120b"]


def test_returns_none_when_no_model_is_available(groq):
    groq(set())
    assert asyncio.run(llm.groq_chat([{"role": "user", "content": "hi"}])) is None


def test_the_configured_model_is_used_when_it_exists(groq):
    seen = groq({"retired-model", "openai/gpt-oss-120b"})
    asyncio.run(llm.groq_chat([{"role": "user", "content": "hi"}]))
    assert seen == ["retired-model"]
