import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .brain import reindex
from .models import Changelog, Chunk, Education, Experience, Profile, Project, Skill, Training

SEED_PATH = Path(__file__).resolve().parents[2] / "content" / "seed.json"


def load_seed() -> dict:
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def seed(db: Session) -> bool:
    """Fill an empty database from content/seed.json. Returns True if it seeded."""
    if db.scalars(select(Profile)).first():
        if not db.scalars(select(Chunk)).first():
            reindex(db)
        return False
    data = load_seed()
    p = data["profile"]
    db.add(Profile(name=p["name"], title=p["title"], summary=p["summary"], contacts=p["contacts"], extras=p.get("extras") or {}))
    order = 0
    for group in data["skills"]:
        for name in group["names"]:
            db.add(Skill(module=group["module"], name=name, sort_order=order))
            order += 1
    for e in data["experience"]:
        db.add(Experience(**e))
    for pr in data["projects"]:
        db.add(Project(**pr))
    for ed in data["education"]:
        db.add(Education(**ed))
    for t in data["trainings"]:
        db.add(Training(**t))
    for c in data["changelog"]:
        db.add(Changelog(entry=c["entry"]))
    db.commit()
    reindex(db)
    return True
