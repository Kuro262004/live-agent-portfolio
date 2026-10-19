from datetime import date as date_t, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from ..database import Base

Json = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Always hands back timezone-aware UTC datetimes (SQLite drops the offset on its own)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class Profile(Base):
    __tablename__ = "profile"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    contacts: Mapped[dict] = mapped_column(Json, default=dict)
    # optional, owner-supplied: {"now_building": str, "stats": [{value, label}], "testimonials": [{quote, name, role}]}
    extras: Mapped[dict | None] = mapped_column(Json, nullable=True, default=dict)


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[int] = mapped_column(primary_key=True)
    module: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(160))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Experience(Base):
    __tablename__ = "experience"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    org: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(240))
    role: Mapped[str] = mapped_column(String(200))
    period: Mapped[str] = mapped_column(String(80))
    bullets: Mapped[list] = mapped_column(Json, default=list)
    stack: Mapped[list] = mapped_column(Json, default=list)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(240))
    context: Mapped[str] = mapped_column(String(240), default="")
    role: Mapped[str] = mapped_column(String(240), default="")
    goal: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(Text, default="")
    stack: Mapped[list] = mapped_column(Json, default=list)
    repo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="published")


class Education(Base):
    __tablename__ = "education"
    id: Mapped[int] = mapped_column(primary_key=True)
    degree: Mapped[str] = mapped_column(String(200))
    specialization: Mapped[str] = mapped_column(String(200), default="")
    school: Mapped[str] = mapped_column(String(300))
    date: Mapped[str] = mapped_column(String(60), default="")


class Training(Base):
    __tablename__ = "trainings"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    provider: Mapped[str] = mapped_column(String(200), default="")
    date: Mapped[str] = mapped_column(String(60), default="")


class Chunk(Base):
    """Shared-brain chunk. Embedding is stored as a JSON float list (see brain/embeddings.py)."""

    __tablename__ = "chunks"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_table: Mapped[str] = mapped_column(String(40), index=True)
    source_id: Mapped[str] = mapped_column(String(80))
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list] = mapped_column(Json, default=list)


class EvolutionDraft(Base):
    __tablename__ = "evolution_drafts"
    id: Mapped[int] = mapped_column(primary_key=True)
    repo: Mapped[str] = mapped_column(String(160))
    commit_range: Mapped[str] = mapped_column(String(120))
    draft_type: Mapped[str] = mapped_column(String(30))  # new_project | project_update | changelog_entry
    content: Mapped[dict] = mapped_column(Json, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Changelog(Base):
    __tablename__ = "changelog"
    id: Mapped[int] = mapped_column(primary_key=True)
    entry: Mapped[str] = mapped_column(Text)
    published_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Mission(Base):
    __tablename__ = "missions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    template_id: Mapped[str] = mapped_column(String(60))
    inputs: Mapped[dict] = mapped_column(Json, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued|running|complete|error
    result: Mapped[dict | None] = mapped_column(Json, nullable=True)
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    ip: Mapped[str] = mapped_column(String(64), default="", index=True)
    replay: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class MissionEvent(Base):
    __tablename__ = "mission_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    mission_id: Mapped[str] = mapped_column(ForeignKey("missions.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    agent: Mapped[str] = mapped_column(String(30))
    type: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class CallSession(Base):
    __tablename__ = "call_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    duration_s: Mapped[int] = mapped_column(Integer, default=0)
    tokens: Mapped[int] = mapped_column(Integer, default=0)
    tts_chars: Mapped[int] = mapped_column(Integer, default=0)
    outcome: Mapped[str] = mapped_column(String(40), default="")
    ip: Mapped[str] = mapped_column(String(64), default="", index=True)


class UsageBudget(Base):
    __tablename__ = "usage_budget"
    date: Mapped[date_t] = mapped_column(Date, primary_key=True)
    llm_tokens: Mapped[int] = mapped_column(Integer, default=0)
    voice_seconds: Mapped[int] = mapped_column(Integer, default=0)
    tts_chars: Mapped[int] = mapped_column(Integer, default=0)
    missions_run: Mapped[int] = mapped_column(Integer, default=0)
    limit_hit: Mapped[bool] = mapped_column(Boolean, default=False)


class AppState(Base):
    """Small key/value store (last evolution run, latest learned commit...)."""

    __tablename__ = "app_state"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(Json, default=dict)
