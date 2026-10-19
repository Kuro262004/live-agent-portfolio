"""Live presence: other visitors as anonymous dots. One in-memory room per server process.

Each socket gets a random id for this visit only. The server relays pointer positions (already throttled by the
browser, and dropped here if they come faster) and the section someone is viewing. Nothing is stored or logged:
no names, no IPs, and everything about a visitor disappears when their tab closes.
"""
import asyncio
import contextlib
import json
import secrets
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

SECTIONS = {"top", "mission", "about", "skills", "experience", "projects", "bestiary", "evolution", "hire", "contact"}
MAX_PEERS = 200  # a portfolio, not a stadium; extra visitors simply aren't shown
MIN_INTERVAL = 0.12  # seconds between relayed moves per visitor (~8 a second)


class Room:
    def __init__(self) -> None:
        self.peers: dict[str, WebSocket] = {}

    async def broadcast(self, msg: dict, skip: str | None = None) -> None:
        text = json.dumps(msg)
        for pid, ws in list(self.peers.items()):
            if pid != skip:
                with contextlib.suppress(Exception):
                    await ws.send_text(text)

    async def count(self) -> None:
        await self.broadcast({"type": "count", "n": len(self.peers)})


room = Room()


def _clamp(v) -> float:
    try:
        return min(1.0, max(0.0, float(v)))
    except (TypeError, ValueError):
        return 0.0


@router.websocket("/ws/presence")
async def presence(ws: WebSocket):
    await ws.accept()
    if len(room.peers) >= MAX_PEERS:
        await ws.close(code=4429)
        return
    me = secrets.token_hex(4)
    room.peers[me] = ws
    await ws.send_json({"type": "hello", "id": me})
    await room.count()
    last = 0.0
    try:
        while True:
            msg = json.loads(await asyncio.wait_for(ws.receive_text(), timeout=300))
            now = time.monotonic()
            if msg.get("type") != "move" or now - last < MIN_INTERVAL:
                continue
            last = now
            section = msg.get("section") if msg.get("section") in SECTIONS else "top"
            await room.broadcast({"type": "move", "id": me, "x": _clamp(msg.get("x")), "y": _clamp(msg.get("y")),
                                  "section": section}, skip=me)
    except (WebSocketDisconnect, asyncio.TimeoutError, ValueError, RuntimeError):
        pass
    finally:
        room.peers.pop(me, None)
        await room.broadcast({"type": "leave", "id": me})
        await room.count()
