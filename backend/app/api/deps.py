import hmac
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request, WebSocket

from ..config import settings


def client_ip(conn: Request | WebSocket) -> str:
    fwd = conn.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return conn.client.host if conn.client else "unknown"


def require_admin(authorization: str | None = Header(default=None)) -> None:
    """Admin and /evolve share one secret (EVOLVE_SECRET) sent as a Bearer token."""
    if not settings.evolve_secret:
        raise HTTPException(503, "Admin is disabled: set EVOLVE_SECRET.")
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(token.encode(), settings.evolve_secret.encode()):
        raise HTTPException(401, "Invalid token.")


class SlidingLimiter:
    """Tiny in-memory per-key limiter for cheap endpoints (chat). Resets on restart."""

    def __init__(self, limit: int, window_s: int) -> None:
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True
