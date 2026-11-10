"""The shared brain: one set of chunks that the chat/voice agent, missions and plain view all read."""
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import (
    Changelog, Chunk, Education, Experience, Profile, Project, Skill, Training,
)
from .embeddings import cosine, embed, tokenize


def build_chunks(db: Session) -> list[tuple[str, str, str]]:
    """(source_table, source_id, content) for everything published."""
    out: list[tuple[str, str, str]] = []
    p = db.scalars(select(Profile)).first()
    if p:
        c = p.contacts or {}
        out.append(("profile", "1", f"{p.name} — {p.title}. {p.summary}"))
        if (p.extras or {}).get("now_building"):
            out.append(("profile", "now", f"What {p.name} is building now: {p.extras['now_building']}"))
        out.append((
            "profile", "contact",
            f"Contact {p.name}: email {c.get('email','')}, "
            + (f"phone {c['phone']}, " if c.get("phone") else "")
            + f"LinkedIn {c.get('linkedin','')}, GitHub {c.get('github','')}. "
            f"Languages: {', '.join(c.get('languages', []))}.",
        ))
    modules: dict[str, list[str]] = {}
    for s in db.scalars(select(Skill).order_by(Skill.module, Skill.sort_order)):
        modules.setdefault(s.module, []).append(s.name)
    for module, names in modules.items():
        out.append(("skills", module, f"Skills — {module}: {', '.join(names)}."))
    for e in db.scalars(select(Experience)):
        out.append((
            "experience", e.id,
            f"{e.title} at {e.org} ({e.period}). Role: {e.role}. " + " ".join(e.bullets)
            + (f" Stack: {', '.join(e.stack)}." if e.stack else ""),
        ))
    for pr in db.scalars(select(Project).where(Project.status == "published")):
        out.append((
            "projects", pr.id,
            f"Project {pr.name} ({pr.context}). Role: {pr.role}. Goal: {pr.goal} Result: {pr.result} "
            f"Tools: {', '.join(pr.stack)}." + (f" Repo: {pr.repo_url}" if pr.repo_url else ""),
        ))
    for ed in db.scalars(select(Education)):
        out.append(("education", str(ed.id), f"Education: {ed.degree}, {ed.specialization}, {ed.school}, {ed.date}."))
    for t in db.scalars(select(Training)):
        out.append(("trainings", str(t.id), f"Training: {t.title} — {t.provider} {t.date}".strip()))
    for ch in db.scalars(select(Changelog).order_by(Changelog.published_at.desc()).limit(20)):
        out.append(("changelog", str(ch.id), f"Changelog: {ch.entry}"))
    return out


def reindex(db: Session) -> int:
    chunks = build_chunks(db)
    db.execute(delete(Chunk))
    for table, sid, content in chunks:
        db.add(Chunk(source_table=table, source_id=sid, content=content, embedding=embed(content)))
    db.commit()
    return len(chunks)


def search(db: Session, query: str, k: int = 4) -> list[dict]:
    """Ranked chunks. Each result has `named=True` when it contains a distinctive word from the query.

    A query word that appears in only a few chunks (AIKO, DamAiyan, BOTPOINTS, Whisper) is treated as a name:
    a project or job that contains it beats the profile summary, which mentions everything."""
    q = embed(query)
    qtoks = set(tokenize(query))
    chunks = list(db.scalars(select(Chunk)))
    toks = {c.id: set(tokenize(c.content)) for c in chunks}
    df: dict[str, int] = {}
    for words in toks.values():
        for w in words:
            df[w] = df.get(w, 0) + 1
    rare = {t for t in qtoks if 0 < df.get(t, 0) <= 3}
    scored = []
    for ch in chunks:
        score = cosine(q, ch.embedding or [])
        # small lexical boost so exact words always count
        score += 0.15 * len(qtoks & toks[ch.id]) / (len(qtoks) or 1)
        named = bool(rare & toks[ch.id])
        if named:
            score += 0.1 if ch.source_table == "profile" else 0.4
        scored.append((score, ch, named))
    scored.sort(key=lambda s: s[0], reverse=True)
    return [
        {"source": c.source_table, "source_id": c.source_id, "content": c.content, "score": round(sc, 3), "named": named}
        for sc, c, named in scored[:k] if sc > 0.05
    ]
