import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..agents.events import backlog, hub
from ..agents.service import MissionError, create_mission, launch
from ..agents.templates import public_templates
from ..database import SessionLocal, get_db
from ..guardrails import captcha
from ..models import Mission
from .deps import client_ip

router = APIRouter()


class MissionIn(BaseModel):
    template_id: str
    inputs: dict = Field(default_factory=dict)
    captcha: str | None = None
    recorded: bool = False  # "Watch a recorded run": a saved run of the template, free and unlimited


@router.get("/api/missions/templates")
def templates():
    return public_templates()


@router.post("/api/missions", status_code=201)
async def start(body: MissionIn, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    if not body.recorded and not await captcha.verify(body.captcha, ip):
        raise HTTPException(400, "Please complete the verification and try again.")
    try:
        mid, replay, reason = create_mission(db, body.template_id, body.inputs, ip, recorded=body.recorded)
    except MissionError as exc:
        raise HTTPException(exc.status, exc.message)
    launch(mid, replay, reason)
    return {"mission_id": mid, "replay": replay, "reason": reason}


def _get(db: Session, mission_id: str) -> Mission:
    m = db.get(Mission, mission_id)
    if m is None:
        raise HTTPException(404, "Mission not found.")
    return m


@router.get("/api/missions/{mission_id}")
def get_mission(mission_id: str, db: Session = Depends(get_db)):
    m = _get(db, mission_id)
    return {"mission_id": m.id, "template_id": m.template_id, "status": m.status, "replay": m.replay,
            "result": m.result, "events": backlog(m.id)}


@router.get("/api/missions/{mission_id}/download")
def download(mission_id: str, db: Session = Depends(get_db)):
    m = _get(db, mission_id)
    if m.status != "complete" or not m.result:
        raise HTTPException(409, "The deliverable isn't ready yet.")
    return Response(
        content=m.result["markdown"], media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{m.template_id}-{m.id}.md"'})


@router.websocket("/ws/missions/{mission_id}")
async def mission_events(ws: WebSocket, mission_id: str):
    with SessionLocal() as db:
        if db.get(Mission, mission_id) is None:
            await ws.close(code=4404)
            return
    await ws.accept()
    q = hub.subscribe(mission_id)  # subscribe first so nothing is missed between backlog and live
    try:
        last = 0
        done = False
        for ev in backlog(mission_id):
            await ws.send_json(ev)
            last = ev["seq"]
            done = done or ev["type"] in ("complete", "error")
        while not done:
            ev = await asyncio.wait_for(q.get(), timeout=300)
            if ev["seq"] <= last:
                continue
            await ws.send_json(ev)
            last = ev["seq"]
            done = ev["type"] in ("complete", "error")
        await ws.close()
    except (WebSocketDisconnect, asyncio.TimeoutError, RuntimeError):
        pass
    finally:
        hub.unsubscribe(mission_id, q)
