import os
import tempfile

# Must be set before the app is imported.
_dir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_dir}/test.db"
for key in ("GROQ_API_KEY", "ANTHROPIC_API_KEY", "FISH_AUDIO_API_KEY", "CAPTCHA_SECRET", "BOOKING_URL"):
    os.environ[key] = ""
os.environ["EVOLVE_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.agents import pipeline  # noqa: E402
from app.main import app  # noqa: E402

pipeline.PACE = 0


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _fresh_usage(client):
    """Each test starts with an empty rate-limit/budget history."""
    from sqlalchemy import delete

    from app.database import SessionLocal
    from app.models import CallSession, Mission, MissionEvent, UsageBudget

    with SessionLocal() as db:
        for model in (MissionEvent, Mission, CallSession, UsageBudget):
            db.execute(delete(model))
        db.commit()
    yield
