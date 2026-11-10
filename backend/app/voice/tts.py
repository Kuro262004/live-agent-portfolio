import re
from typing import AsyncIterator

import httpx

from ..config import settings

URL = "https://api.fish.audio/v1/tts"


def available() -> bool:
    return bool(settings.fish_audio_api_key)


def headers() -> dict[str, str]:
    """Auth header, plus the `model` header when FISH_AUDIO_MODEL is set (otherwise Fish picks its default)."""
    h = {"Authorization": f"Bearer {settings.fish_audio_api_key}"}
    if settings.fish_audio_model:
        h["model"] = settings.fish_audio_model
    return h


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]


async def synth_stream(text: str) -> AsyncIterator[bytes]:
    """Stream one sentence of speech as MP3 bytes from Fish Audio. Yields nothing on failure."""
    if not available() or not text.strip():
        return
    body: dict = {"text": text, "format": "mp3", "latency": "balanced"}
    if settings.fish_audio_voice_id:
        body["reference_id"] = settings.fish_audio_voice_id
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream("POST", URL, json=body,
                                     headers=headers()) as r:
                r.raise_for_status()
                async for chunk in r.aiter_bytes():
                    if chunk:
                        yield chunk
    except httpx.HTTPError:
        return
