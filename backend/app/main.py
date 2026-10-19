import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import admin, call, missions, navigate, presence, public
from .config import check_production_settings, settings
from .database import SessionLocal
from .retention import retention_loop
from .seed import seed

BACKEND_DIR = Path(__file__).resolve().parents[1]


def migrate() -> None:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    check_production_settings()
    migrate()
    with SessionLocal() as db:
        seed(db)
    cleanup = asyncio.create_task(retention_loop())
    yield
    cleanup.cancel()


app = FastAPI(title="Justin H. Sales — Live Agent Portfolio", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(public.router)
app.include_router(missions.router)
app.include_router(call.router)
app.include_router(admin.router)
app.include_router(navigate.router)
app.include_router(presence.router)
