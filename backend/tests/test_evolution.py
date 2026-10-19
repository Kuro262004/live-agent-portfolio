import asyncio
from datetime import datetime, timezone

import httpx
import pytest

from app import evolution
from app.database import SessionLocal
from app.evolution import github
from app.models import Changelog, Chunk, EvolutionDraft, Project
from sqlalchemy import delete, select

AUTH = {"Authorization": "Bearer test-secret"}


def activity(repo="cool-bot", n=4):
    return {"repo": repo, "url": f"https://github.com/Kuro262004/{repo}", "description": "A small bot",
            "language": "Python", "topics": ["fastapi"],
            "commits": [{"sha": f"a{i}b2c3d", "message": f"Add feature {i}", "date": "2026-10-13T10:00:00Z"} for i in range(n, 0, -1)]}


@pytest.fixture(autouse=True)
def clean():
    with SessionLocal() as db:
        db.execute(delete(EvolutionDraft))
        db.execute(delete(Project).where(Project.id == "cool-bot"))
        db.commit()
    yield


def test_evolve_requires_secret(client):
    assert client.post("/evolve").status_code == 401
    assert client.post("/evolve", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/api/admin/drafts").status_code == 401


def test_run_creates_pending_drafts_without_publishing():
    async def fetch(since):
        return [activity("cool-bot", 4), activity("tiny-tool", 1)]

    with SessionLocal() as db:
        out = asyncio.run(evolution.run(db, fetch=fetch))
        assert out == {"drafts_created": 2, "repos_seen": 2}
        drafts = {d.repo: d for d in evolution.pending(db)}
        assert drafts["cool-bot"].draft_type == "new_project" and drafts["cool-bot"].status == "pending"
        assert drafts["tiny-tool"].draft_type == "changelog_entry"
        # nothing is live yet
        assert db.get(Project, "cool-bot") is None
        c = drafts["cool-bot"].content
        assert c["commit_count"] == 4 and c["latest_commit"] == "Add feature 4"
        assert "4 new commits" in c["changelog"]
        # no invented claims: the result line only restates the commit count and latest message
        assert c["project"]["result"] == "4 commits so far; latest: Add feature 4"


def test_approve_publishes_reembeds_and_updates_badge(client):
    async def fetch(since):
        return [activity("cool-bot", 3)]

    with SessionLocal() as db:
        asyncio.run(evolution.run(db, fetch=fetch))
        d = evolution.pending(db)[0]
        did = d.id
    r = client.post(f"/api/admin/drafts/{did}/approve", headers=AUTH, json={"content": {
        **d.content, "project": {**d.content["project"], "goal": "A small Telegram helper bot"}}})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    with SessionLocal() as db:
        p = db.get(Project, "cool-bot")
        assert p and p.goal == "A small Telegram helper bot" and p.repo_url.endswith("/cool-bot")
        assert db.scalars(select(Chunk).where(Chunk.source_table == "projects", Chunk.source_id == "cool-bot")).first()
        assert db.scalars(select(Changelog).where(Changelog.entry.like("3 new commits in cool-bot%"))).first()
    st = client.get("/api/evolution/status").json()
    assert st["commits_learned"] >= 3 and st["latest_commit"] == "Add feature 3" and st["repo"] == "cool-bot"
    assert any(x["id"] == "cool-bot" for x in client.get("/api/profile").json()["projects"])
    from app.brain import search
    with SessionLocal() as db:
        assert search(db, "cool-bot A small Telegram helper bot", k=1)[0]["source_id"] == "cool-bot"
    # approving twice is refused
    assert client.post(f"/api/admin/drafts/{did}/approve", headers=AUTH).status_code == 409


def test_reject_leaves_site_untouched(client):
    async def fetch(since):
        return [activity("cool-bot", 5)]

    with SessionLocal() as db:
        asyncio.run(evolution.run(db, fetch=fetch))
        did = evolution.pending(db)[0].id
    assert client.post(f"/api/admin/drafts/{did}/reject", headers=AUTH).json()["status"] == "rejected"
    with SessionLocal() as db:
        assert db.get(Project, "cool-bot") is None


def test_github_fetch_reads_only_public_non_fork_repos():
    since = datetime(2026, 10, 1, tzinfo=timezone.utc)

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/users/Kuro262004/repos":
            base = {"html_url": "https://github.com/Kuro262004/x", "description": "", "language": "Python",
                    "topics": [], "pushed_at": "2026-10-10T00:00:00Z", "fork": False, "archived": False, "private": False}
            return httpx.Response(200, json=[
                {**base, "name": "pub"},
                {**base, "name": "secret", "private": True},
                {**base, "name": "forked", "fork": True},
                {**base, "name": "stale", "pushed_at": "2026-09-01T00:00:00Z"},
            ])
        if path == "/repos/Kuro262004/pub/commits":
            return httpx.Response(200, json=[
                {"sha": "1234567890", "commit": {"message": "Real change\n\nbody", "author": {"date": "2026-10-10T00:00:00Z"}}},
                {"sha": "abcdef1234", "commit": {"message": "Merge branch 'x'", "author": {"date": "2026-10-09T00:00:00Z"}}},
            ])
        raise AssertionError(f"unexpected request to {path}")

    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.github.com") as c:
            return await github.fetch_activity(since, client=c)

    out = asyncio.run(go())
    assert [a["repo"] for a in out] == ["pub"]
    assert [c["message"] for c in out[0]["commits"]] == ["Real change"]
