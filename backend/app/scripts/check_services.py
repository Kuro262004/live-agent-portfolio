"""Check that the configured API keys actually work, without printing them.

    python -m app.scripts.check_services

Each line is: service, configured?, works?. Keys are read from backend/.env or the environment. The Groq, Anthropic and
Fish Audio requests are small (a model list, a one-token reply, a one-word speech clip). Fish Audio's request shape follows
its public docs and has not been run by the author, so a failure there is worth reading the printed status for.
"""
import asyncio
import sys

import httpx

from ..config import settings


async def _groq(client: httpx.AsyncClient) -> str:
    r = await client.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {settings.groq_api_key}"})
    if r.status_code != 200:
        return f"HTTP {r.status_code}"
    available = {m["id"] for m in r.json().get("data", [])}
    wanted = [settings.groq_chat_model, *[m.strip() for m in settings.groq_chat_fallbacks.split(",") if m.strip()]]
    usable = next((m for m in wanted if m in available), None)
    stt = settings.groq_stt_model in available
    if usable is None:
        chat = sorted(m for m in available if "whisper" not in m and "guard" not in m and "orpheus" not in m)
        return f"key works, but none of the configured chat models exist on your account. Available: {', '.join(chat)}. Set GROQ_CHAT_MODEL to one of them"
    note = "" if usable == settings.groq_chat_model else f" (configured model {settings.groq_chat_model!r} is NOT available; will fall back to {usable!r}. Set GROQ_CHAT_MODEL={usable} to fix this)"
    note += "" if stt else f" (speech model {settings.groq_stt_model!r} is NOT available; voice calls need one of: {', '.join(sorted(m for m in available if 'whisper' in m))})"
    return "ok" + note


async def _anthropic(client: httpx.AsyncClient) -> str:
    r = await client.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01"},
        json={"model": settings.anthropic_model, "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]},
    )
    return "ok" if r.status_code == 200 else f"HTTP {r.status_code} (model {settings.anthropic_model})"


async def _fish(client: httpx.AsyncClient) -> str:
    body = {"text": "ok", "format": "mp3"}
    if settings.fish_audio_voice_id:
        body["reference_id"] = settings.fish_audio_voice_id
    from ..voice.tts import headers

    r = await client.post("https://api.fish.audio/v1/tts", headers=headers(), json=body)
    model = f" (model {settings.fish_audio_model})" if settings.fish_audio_model else ""
    return "ok" if r.status_code == 200 and r.content else f"HTTP {r.status_code}{model}"


async def _github(client: httpx.AsyncClient) -> str:
    r = await client.get(f"https://api.github.com/users/{settings.github_username}/repos?per_page=1",
                         headers={"Authorization": f"Bearer {settings.github_token}"} if settings.github_token else {})
    return "ok" if r.status_code == 200 else f"HTTP {r.status_code}"


async def main() -> int:
    checks = [
        ("Groq (chat + Whisper speech-to-text)", bool(settings.groq_api_key), _groq),
        ("Anthropic Claude (long writing)", bool(settings.anthropic_api_key), _anthropic),
        ("Fish Audio (text-to-speech)", bool(settings.fish_audio_api_key), _fish),
        ("GitHub (nightly evolution)", True, _github),
    ]
    failed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for name, configured, fn in checks:
            if not configured:
                print(f"-  {name}: not configured")
                continue
            try:
                result = await fn(client)
            except httpx.HTTPError as exc:
                result = f"network error ({type(exc).__name__})"
            good = result == "ok" or result.startswith("ok (")
            print(f"{'✓' if result == 'ok' else '!' if good else '✗'}  {name}: {result}")
            failed += not good
    print()
    print(f"CAPTCHA (Turnstile secret): {'set' if settings.captcha_secret else 'NOT set'}"
          + ("  <- required before going public if any AI key is set" if not settings.captcha_secret else ""))
    print(f"EVOLVE_SECRET (admin + nightly job): {'set' if settings.evolve_secret else 'NOT set'}")
    print(f"BOOKING_URL: {settings.booking_url or 'not set (Book a call falls back to the contact section)'}")
    return 1 if failed else 0


if __name__ == "__main__":
    # Windows consoles default to a code page that cannot print the check marks
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(asyncio.run(main()))
