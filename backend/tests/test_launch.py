import time

import pytest

from app import config
from app.config import settings


def wait_complete(client, mid, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        m = client.get(f"/api/missions/{mid}").json()
        if m["status"] in ("complete", "error"):
            return m
        time.sleep(0.05)
    raise AssertionError("mission did not finish")


# ---- production guard -------------------------------------------------------------------------

def test_production_with_ai_keys_requires_captcha(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "cors_origins", "https://justin.example")
    monkeypatch.setattr(settings, "groq_api_key", "gsk_test")
    monkeypatch.setattr(settings, "captcha_secret", "")
    with pytest.raises(RuntimeError, match="CAPTCHA_SECRET"):
        config.check_production_settings()
    monkeypatch.setattr(settings, "captcha_secret", "turnstile-secret")
    config.check_production_settings()  # fine now


def test_production_without_ai_keys_does_not_need_captcha(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "cors_origins", "https://justin.example")
    for key in ("groq_api_key", "anthropic_api_key", "fish_audio_api_key", "captcha_secret"):
        monkeypatch.setattr(settings, key, "")
    config.check_production_settings()


def test_production_refuses_localhost_cors(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "cors_origins", "http://localhost:5173")
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        config.check_production_settings()


def test_development_is_never_blocked(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "groq_api_key", "gsk_test")
    monkeypatch.setattr(settings, "captcha_secret", "")
    config.check_production_settings()


# ---- recorded run on demand -------------------------------------------------------------------

def test_watch_a_recorded_run_needs_no_inputs_and_uses_nothing_up(client):
    for _ in range(settings.ip_missions_per_day + 2):  # more than the daily limit
        r = client.post("/api/missions", json={"template_id": "hotel-self-service", "recorded": True})
        assert r.status_code == 201
        assert r.json()["replay"] is True and r.json()["reason"] == "recorded"
    m = wait_complete(client, r.json()["mission_id"])
    assert m["status"] == "complete" and m["replay"] is True
    assert m["events"][0]["message"].startswith("Replaying a recorded run")
    assert "## Guest journey" in m["result"]["markdown"]
    # and a real run is still allowed afterwards
    live = client.post("/api/missions", json={"template_id": "workflow-audit", "inputs": {"process": "A\nB"}}).json()
    assert live["replay"] is False


def test_recorded_run_for_an_unknown_template_is_a_clean_404(client):
    assert client.post("/api/missions", json={"template_id": "nope", "recorded": True}).status_code == 404


# ---- answer language --------------------------------------------------------------------------

def test_other_languages_are_honest_when_no_live_model_is_connected(client):
    r = client.post("/api/chat", json={"message": "What is AIKO?", "language": "Ilocano"}).json()["reply"]
    assert "only answer in Ilocano when a live AI model is connected" in r and "telephone operator" in r
    plain = client.post("/api/chat", json={"message": "What is AIKO?", "language": "English"}).json()["reply"]
    assert "live AI model" not in plain


def test_call_accepts_a_language(client):
    with client.websocket_connect("/ws/call") as ws:
        ws.send_json({"type": "start", "mode": "text", "language": "Filipino"})
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "text", "text": "What is AIKO?"})
        texts = []
        while len(texts) < 2:
            raw = ws.receive()
            if raw.get("text") and '"reply"' in raw["text"]:
                texts.append(raw["text"])
    assert "Filipino" in texts[1]


# ---- profile extras ---------------------------------------------------------------------------

def test_profile_exposes_now_building_and_optional_sections(client):
    p = client.get("/api/profile").json()["profile"]
    assert "AIKO" in p["now_building"]
    assert p["stats"] == [] and p["testimonials"] == []  # nothing invented: the owner supplies numbers and quotes


def test_the_assistant_knows_what_justin_is_building_now(client):
    from app.brain import search
    from app.database import SessionLocal

    with SessionLocal() as db:
        top = search(db, "what is he building now", k=3)
    assert any(h["source_id"] == "now" for h in top)
