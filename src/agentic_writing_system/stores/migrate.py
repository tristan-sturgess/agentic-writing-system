"""Run Alembic migrations against the application database."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from agentic_writing_system.settings import Settings


def run_migrations(settings: Settings) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
    cfg = Config()
    cfg.set_main_option("script_location", str(migrations_dir))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{settings.app_db_path}")
    command.upgrade(cfg, "head")
