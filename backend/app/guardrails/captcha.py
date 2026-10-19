import httpx

from ..config import settings

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify(token: str | None, ip: str) -> bool:
    """Cloudflare Turnstile. With no CAPTCHA_SECRET configured (local dev) it lets everything through."""
    if not settings.captcha_secret:
        return True
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(VERIFY_URL, data={"secret": settings.captcha_secret, "response": token,
                                                    "remoteip": ip})
            return bool(r.json().get("success"))
    except (httpx.HTTPError, ValueError):
        return False
