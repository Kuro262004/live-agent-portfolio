"""The same question must get the same good answer from the text chat and from a call."""
import json

import pytest

CASES = [
    ("What is AIKO?", "telephone operator"),
    ("Tell me about AIKO", "telephone operator"),
    ("What has Justin built with voice AI?", "AIKO"),
    ("What is DamAiyan?", "Rural Health Units"),
    ("Tell me about BOTPOINTS", "bottle"),
    ("What is the hotel scan to order project?", "QR"),
    ("What's his tech stack?", "FastAPI"),
    ("What are his skills?", "AI & Voice"),
    ("Is he working on face detection?", "blurring"),
]

PROFILE_TITLE = "Full-Stack Developer — AI Automation & Agentic AI"


@pytest.mark.parametrize("question,expected", CASES)
def test_chat_answers(client, question, expected):
    reply = client.post("/api/chat", json={"message": question}).json()["reply"]
    assert expected.lower() in reply.lower(), reply
    assert PROFILE_TITLE not in reply  # never the profile headline for a question about a project


@pytest.mark.parametrize("question,expected", CASES)
def test_call_answers_match_chat(client, question, expected):
    chat = client.post("/api/chat", json={"message": question}).json()["reply"]
    with client.websocket_connect("/ws/call") as ws:
        ws.send_json({"type": "start", "mode": "text"})
        ws.receive_json()  # ready
        ws.send_json({"type": "text", "text": question})
        replies = []
        while len(replies) < 2:  # greeting, then the answer
            raw = ws.receive()
            if raw.get("text") is None:
                continue
            msg = json.loads(raw["text"])
            if msg["type"] == "reply":
                replies.append(msg["text"])
    assert replies[1] == chat


def test_a_project_name_beats_the_profile_summary(client):
    from app.brain import search
    from app.database import SessionLocal

    with SessionLocal() as db:
        for query, source, source_id in [("AIKO", "experience", "aiko"), ("DamAiyan", "projects", "damaiyan"),
                                         ("BOTPOINTS", "projects", "botpoints")]:
            top = search(db, query, k=3)[0]
            assert (top["source"], top["source_id"]) == (source, source_id), query
            assert top["named"] is True
