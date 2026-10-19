"""Read-only access to the owner's PUBLIC GitHub repos and their recent commits."""
from datetime import datetime, timedelta, timezone

import httpx

from ..config import settings

API = "https://api.github.com"
MAX_REPOS = 10
MAX_COMMITS = 30


def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h


async def fetch_activity(since: datetime | None, client: httpx.AsyncClient | None = None) -> list[dict]:
    """[{repo, url, description, language, topics, commits: [{sha, message, date}]}] for repos pushed since `since`.

    Private repos, forks and archived repos are skipped even if the token could see them."""
    since = since or (datetime.now(timezone.utc) - timedelta(days=30))
    own = client is None
    client = client or httpx.AsyncClient(timeout=20, headers=_headers())
    try:
        r = await client.get(f"{API}/users/{settings.github_username}/repos",
                             params={"per_page": 100, "type": "owner", "sort": "pushed"})
        r.raise_for_status()
        out = []
        for repo in r.json():
            if repo.get("private") or repo.get("fork") or repo.get("archived") or repo.get("visibility", "public") != "public":
                continue
            pushed = datetime.fromisoformat(repo["pushed_at"].replace("Z", "+00:00")) if repo.get("pushed_at") else None
            if pushed is None or pushed <= since:
                continue
            cr = await client.get(f"{API}/repos/{settings.github_username}/{repo['name']}/commits",
                                  params={"since": since.isoformat(), "per_page": MAX_COMMITS})
            if cr.status_code != 200:
                continue
            commits = []
            for c in cr.json():
                msg = (c["commit"]["message"] or "").splitlines()[0][:200]
                if msg.lower().startswith("merge"):
                    continue
                commits.append({"sha": c["sha"][:7], "message": msg, "date": c["commit"]["author"]["date"]})
            if commits:
                out.append({"repo": repo["name"], "url": repo["html_url"], "description": repo.get("description") or "",
                            "language": repo.get("language") or "", "topics": repo.get("topics") or [],
                            "commits": commits})
            if len(out) >= MAX_REPOS:
                break
        return out
    finally:
        if own:
            await client.aclose()
