import sys


def test_python_version() -> None:
    assert sys.version_info[:2] == (3, 14)


def test_core_libraries_import() -> None:
    import aiosqlite  # noqa: F401
    import alembic  # noqa: F401
    import fastapi  # noqa: F401
    import psycopg  # noqa: F401
    import sqlalchemy.ext.asyncio  # noqa: F401
    from langchain.agents import create_agent  # noqa: F401
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver  # noqa: F401
    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver  # noqa: F401
