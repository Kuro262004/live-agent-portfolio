from fastapi import APIRouter, WebSocket

from ..voice.session import Call
from .deps import client_ip

router = APIRouter()


@router.websocket("/ws/call")
async def call(ws: WebSocket):
    await Call(ws, client_ip(ws)).run()
