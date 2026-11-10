"""SQLAlchemy Core metadata for the application database."""

from __future__ import annotations

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Table,
    Text,
    UniqueConstraint,
)

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("user_id", Text, primary_key=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

stories = Table(
    "stories",
    metadata,
    Column("story_id", Text, primary_key=True),
    Column(
        "owner_id",
        Text,
        ForeignKey("users.user_id"),
        nullable=False,
    ),
    Column("schema_version", Integer, nullable=False),
    Column("fields", JSON, nullable=False),
    Column("names", JSON, nullable=False),
    Column("revision", Integer, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

records = Table(
    "records",
    metadata,
    Column("seq", Integer, primary_key=True, autoincrement=True),
    Column(
        "story_id",
        Text,
        ForeignKey("stories.story_id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("record_id", Text, nullable=False),
    Column("kind", Text, nullable=False),
    Column("fields", JSON, nullable=False),
    Column("names", JSON, nullable=False),
    Column("revision", Integer, nullable=False),
    UniqueConstraint("story_id", "record_id", name="uq_records_story_record"),
)

commits = Table(
    "commits",
    metadata,
    Column("seq", Integer, primary_key=True, autoincrement=True),
    Column("commit_id", Text, unique=True, nullable=False),
    Column(
        "story_id",
        Text,
        ForeignKey("stories.story_id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("user_id", Text, nullable=False),
    Column("committed_at", DateTime(timezone=True), nullable=False),
    Column("source", Text, nullable=False),
    Column("thread_id", Text, nullable=True),
    Column("run_id", Text, nullable=True),
    Column("tool_call_id", Text, nullable=True),
    Column("reverts", JSON, nullable=False),
    Column("changes", JSON, nullable=False),
)

__all__ = ["commits", "metadata", "records", "stories", "users"]
