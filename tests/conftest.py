"""Shared fixtures: each test gets its own data directory and migrated database."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from agentic_writing_system.settings import Settings
from agentic_writing_system.stores.engine import create_app_engine
from agentic_writing_system.stores.migrate import run_migrations
from agentic_writing_system.stores.sql_story_store import SqlStoryStore
from agentic_writing_system.stores.users import LOCAL_USER_ID, SqlUserStore


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(data_dir=tmp_path / "data", install="local")


@pytest.fixture
async def engine(settings: Settings) -> AsyncIterator[AsyncEngine]:
    await asyncio.to_thread(run_migrations, settings)
    eng = create_app_engine(settings)
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest.fixture
async def user_id(engine: AsyncEngine) -> str:
    store = SqlUserStore(engine)
    await store.ensure_user(LOCAL_USER_ID)
    return LOCAL_USER_ID


@pytest.fixture
async def story_store(engine: AsyncEngine) -> SqlStoryStore:
    return SqlStoryStore(engine)
