import httpx

from ..config import settings
from .vad import to_wav

URL = "https://api.groq.com/openai/v1/audio/transcriptions"


def available() -> bool:
    return bool(settings.groq_api_key)


async def transcribe(pcm: bytes) -> str | None:
    """Whisper (via Groq). Audio is sent for transcription and never stored."""
    if not available():
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                data={"model": settings.groq_stt_model, "response_format": "json", "temperature": "0"},
                files={"file": ("utterance.wav", to_wav(pcm), "audio/wav")},
            )
            r.raise_for_status()
            return (r.json().get("text") or "").strip()
    except (httpx.HTTPError, ValueError):
        return None
