"""Async SQLAlchemy engine for the application database."""

from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from agentic_writing_system.settings import Settings

_BEGIN_OPTION = "sqlite_begin"


def create_app_engine(settings: Settings) -> AsyncEngine:
    """Open `settings.app_db_path` in WAL mode with a busy timeout.

    A transaction on this engine starts with `BEGIN IMMEDIATE`, so a store that
    reads rows and then writes them holds the write lock from its first read. A
    deferred transaction that read first would fail with a busy-snapshot error
    when a second writer got in between. Reads that never write use
    `read_only(engine)` and do not take the write lock.
    """
    url = f"sqlite+aiosqlite:///{settings.app_db_path.as_posix()}"
    engine = create_async_engine(url)

    @event.listens_for(engine.sync_engine, "connect")
    def _on_connect(dbapi_connection: object, connection_record: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
        # The driver must not emit its own BEGIN; _on_begin does.
        dbapi_connection.isolation_level = None  # type: ignore[attr-defined]

    @event.listens_for(engine.sync_engine, "begin")
    def _on_begin(conn: Connection) -> None:
        mode = conn.get_execution_options().get(_BEGIN_OPTION, "IMMEDIATE")
        conn.exec_driver_sql(f"BEGIN {mode}")

    return engine


def read_only(engine: AsyncEngine) -> AsyncEngine:
    """The same engine and pool, for transactions that only read.

    They start with a plain `BEGIN`, so in WAL mode they read a consistent
    snapshot without waiting for a writer.
    """
    return engine.execution_options(**{_BEGIN_OPTION: "DEFERRED"})
