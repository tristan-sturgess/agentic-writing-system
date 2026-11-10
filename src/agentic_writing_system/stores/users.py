"""User rows in the application database."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncEngine

from agentic_writing_system.stores.tables import users

LOCAL_USER_ID = "local"


class SqlUserStore:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def ensure_user(self, user_id: str) -> None:
        async with self._engine.connect() as conn:
            exists = await conn.execute(
                select(users.c.user_id).where(users.c.user_id == user_id)
            )
            if exists.first() is not None:
                return
            await conn.execute(
                insert(users).values(
                    user_id=user_id,
                    created_at=datetime.now(UTC),
                )
            )
            await conn.commit()
