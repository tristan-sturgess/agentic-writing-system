"""SQLite adapter for the story store."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from agentic_writing_system.stores.engine import read_only
from agentic_writing_system.stores.story_store import (
    Change,
    CommitRecord,
    CommitSource,
    Conflict,
    ConflictRow,
    CreateRow,
    DeleteRow,
    GuardRow,
    RecordRow,
    RowOp,
    Saved,
    StoreBusyError,
    StoredStory,
    StoryNotFoundError,
    StoryRow,
    StoryStore,
    UpdateRow,
)
from agentic_writing_system.stores.tables import commits, records, stories


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _row_target(op: RowOp) -> str | None:
    if isinstance(op, CreateRow):
        return op.record_id
    if isinstance(op, UpdateRow | GuardRow):
        return op.record_id
    return op.record_id


def _validate_changeset(changeset: Sequence[RowOp]) -> None:
    if not changeset:
        msg = "changeset must not be empty"
        raise ValueError(msg)
    seen: set[str | None] = set()
    for op in changeset:
        target = _row_target(op)
        if target in seen:
            msg = "two operations on the same row"
            raise ValueError(msg)
        seen.add(target)


def _story_from_row(row: Any) -> StoryRow:
    return StoryRow(
        story_id=row.story_id,
        owner_id=row.owner_id,
        schema_version=row.schema_version,
        fields=row.fields,
        names=list(row.names),
        revision=row.revision,
        created_at=_as_utc(row.created_at),
        updated_at=_as_utc(row.updated_at),
    )


def _record_from_row(row: Any) -> RecordRow:
    return RecordRow(
        record_id=row.record_id,
        kind=row.kind,
        fields=row.fields,
        names=list(row.names),
        revision=row.revision,
    )


def _busy(exc: OperationalError) -> bool:
    return "database is locked" in str(exc.orig).lower()


class SqlStoryStore:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._reads = read_only(engine)

    async def create(self, user_id: str) -> StoryRow:
        now = _utc_now()
        story_id = uuid.uuid4().hex
        try:
            async with self._engine.begin() as conn:
                await conn.execute(
                    insert(stories).values(
                        story_id=story_id,
                        owner_id=user_id,
                        schema_version=1,
                        fields={},
                        names=[],
                        revision=1,
                        created_at=now,
                        updated_at=now,
                    )
                )
        except OperationalError as exc:
            if _busy(exc):
                raise StoreBusyError from exc
            raise
        return StoryRow(
            story_id=story_id,
            owner_id=user_id,
            schema_version=1,
            fields={},
            names=[],
            revision=1,
            created_at=now,
            updated_at=now,
        )

    async def load(self, user_id: str, story_id: str) -> StoredStory:
        try:
            async with self._reads.connect() as conn:
                story = await self._load_story(conn, user_id, story_id)
                record_rows = await conn.execute(
                    select(records)
                    .where(records.c.story_id == story_id)
                    .order_by(records.c.seq)
                )
                return StoredStory(
                    story=story,
                    records=[_record_from_row(r) for r in record_rows],
                )
        except OperationalError as exc:
            if _busy(exc):
                raise StoreBusyError from exc
            raise

    async def save(
        self,
        user_id: str,
        story_id: str,
        changeset: Sequence[RowOp],
        source: CommitSource,
    ) -> Saved | Conflict:
        _validate_changeset(changeset)
        try:
            async with self._engine.begin() as conn:
                return await self._save_in_transaction(
                    conn, user_id, story_id, changeset, source
                )
        except OperationalError as exc:
            if _busy(exc):
                raise StoreBusyError from exc
            raise

    async def _save_in_transaction(
        self,
        conn: AsyncConnection,
        user_id: str,
        story_id: str,
        changeset: Sequence[RowOp],
        source: CommitSource,
    ) -> Saved | Conflict:
        story_db = await self._fetch_story_row(conn, story_id)
        if story_db is None or story_db.owner_id != user_id:
            raise StoryNotFoundError(story_id)

        stored_story = _story_from_row(story_db)
        record_result = await conn.execute(
            select(records)
            .where(records.c.story_id == story_id)
            .order_by(records.c.seq)
        )
        stored_records = {r.record_id: _record_from_row(r) for r in record_result}

        conflicts: list[ConflictRow] = []

        for op in changeset:
            if isinstance(op, CreateRow):
                current = stored_records.get(op.record_id)
                if current is not None:
                    conflicts.append(
                        ConflictRow(
                            record_id=op.record_id,
                            reason="already_exists",
                            current=current,
                        )
                    )
            elif isinstance(op, UpdateRow):
                if op.record_id is None:
                    if stored_story.revision != op.expected_revision:
                        conflicts.append(
                            ConflictRow(
                                record_id=None,
                                reason="revision_mismatch",
                                current=stored_story,
                            )
                        )
                else:
                    current = stored_records.get(op.record_id)
                    if current is None:
                        conflicts.append(
                            ConflictRow(
                                record_id=op.record_id,
                                reason="missing",
                                current=None,
                            )
                        )
                    elif current.revision != op.expected_revision:
                        conflicts.append(
                            ConflictRow(
                                record_id=op.record_id,
                                reason="revision_mismatch",
                                current=current,
                            )
                        )
            elif isinstance(op, DeleteRow):
                current = stored_records.get(op.record_id)
                if current is None:
                    conflicts.append(
                        ConflictRow(
                            record_id=op.record_id,
                            reason="missing",
                            current=None,
                        )
                    )
                elif current.revision != op.expected_revision:
                    conflicts.append(
                        ConflictRow(
                            record_id=op.record_id,
                            reason="revision_mismatch",
                            current=current,
                        )
                    )
            elif isinstance(op, GuardRow):
                if op.record_id is None:
                    if stored_story.revision != op.expected_revision:
                        conflicts.append(
                            ConflictRow(
                                record_id=None,
                                reason="revision_mismatch",
                                current=stored_story,
                            )
                        )
                else:
                    current = stored_records.get(op.record_id)
                    if current is None:
                        conflicts.append(
                            ConflictRow(
                                record_id=op.record_id,
                                reason="missing",
                                current=None,
                            )
                        )
                    elif current.revision != op.expected_revision:
                        conflicts.append(
                            ConflictRow(
                                record_id=op.record_id,
                                reason="revision_mismatch",
                                current=current,
                            )
                        )

        working_story = deepcopy(stored_story)
        working_records = deepcopy(stored_records)

        if not conflicts:
            for op in changeset:
                if isinstance(op, CreateRow):
                    working_records[op.record_id] = RecordRow(
                        record_id=op.record_id,
                        kind=op.kind,
                        fields=deepcopy(op.fields),
                        names=list(op.names),
                        revision=1,
                    )
                elif isinstance(op, UpdateRow):
                    if op.record_id is None:
                        working_story = StoryRow(
                            story_id=working_story.story_id,
                            owner_id=working_story.owner_id,
                            schema_version=working_story.schema_version,
                            fields=deepcopy(op.fields),
                            names=list(op.names),
                            revision=working_story.revision + 1,
                            created_at=working_story.created_at,
                            updated_at=working_story.updated_at,
                        )
                    else:
                        cur = working_records[op.record_id]
                        working_records[op.record_id] = RecordRow(
                            record_id=cur.record_id,
                            kind=cur.kind,
                            fields=deepcopy(op.fields),
                            names=list(op.names),
                            revision=cur.revision + 1,
                        )
                elif isinstance(op, DeleteRow):
                    del working_records[op.record_id]
                elif isinstance(op, GuardRow):
                    if op.record_id is None:
                        working_story = StoryRow(
                            story_id=working_story.story_id,
                            owner_id=working_story.owner_id,
                            schema_version=working_story.schema_version,
                            fields=working_story.fields,
                            names=working_story.names,
                            revision=working_story.revision + 1,
                            created_at=working_story.created_at,
                            updated_at=working_story.updated_at,
                        )
                    else:
                        cur = working_records[op.record_id]
                        working_records[op.record_id] = RecordRow(
                            record_id=cur.record_id,
                            kind=cur.kind,
                            fields=cur.fields,
                            names=cur.names,
                            revision=cur.revision + 1,
                        )

            record_ids = set(working_records.keys())
            rows_to_check: list[tuple[str | None, list[str]]] = [
                (None, working_story.names),
                *((rec.record_id, rec.names) for rec in working_records.values()),
            ]
            for record_id, names in rows_to_check:
                missing = [n for n in names if n not in record_ids]
                if missing:
                    if record_id is None:
                        stored_current: RecordRow | StoryRow | None = stored_story
                    else:
                        stored_current = stored_records.get(record_id)
                    conflicts.append(
                        ConflictRow(
                            record_id=record_id,
                            reason="dangling_name",
                            current=stored_current,
                            missing_names=missing,
                        )
                    )

        if conflicts:
            return Conflict(rows=conflicts)

        now = _utc_now()
        commit_id = uuid.uuid4().hex
        change_entries: list[Change] = []
        new_revisions: dict[str, int] = {}
        story_revision: int | None = None

        for op in changeset:
            if isinstance(op, CreateRow):
                change_entries.append(
                    Change(
                        record_id=op.record_id,
                        kind=op.kind,
                        op="create",
                        before=None,
                        after=deepcopy(op.fields),
                    )
                )
                await conn.execute(
                    insert(records).values(
                        story_id=story_id,
                        record_id=op.record_id,
                        kind=op.kind,
                        fields=op.fields,
                        names=op.names,
                        revision=1,
                    )
                )
                new_revisions[op.record_id] = 1
            elif isinstance(op, UpdateRow):
                if op.record_id is None:
                    before_fields = stored_story.fields
                    change_entries.append(
                        Change(
                            record_id=None,
                            kind="story",
                            op="update",
                            before=deepcopy(before_fields),
                            after=deepcopy(op.fields),
                        )
                    )
                    await conn.execute(
                        update(stories)
                        .where(stories.c.story_id == story_id)
                        .values(
                            fields=op.fields,
                            names=op.names,
                            revision=working_story.revision,
                        )
                    )
                    story_revision = working_story.revision
                else:
                    before_fields = stored_records[op.record_id].fields
                    cur = working_records[op.record_id]
                    change_entries.append(
                        Change(
                            record_id=op.record_id,
                            kind=cur.kind,
                            op="update",
                            before=deepcopy(before_fields),
                            after=deepcopy(op.fields),
                        )
                    )
                    await conn.execute(
                        update(records)
                        .where(
                            records.c.story_id == story_id,
                            records.c.record_id == op.record_id,
                        )
                        .values(
                            fields=op.fields,
                            names=op.names,
                            revision=cur.revision,
                        )
                    )
                    new_revisions[op.record_id] = cur.revision
            elif isinstance(op, DeleteRow):
                before_fields = stored_records[op.record_id].fields
                cur = stored_records[op.record_id]
                change_entries.append(
                    Change(
                        record_id=op.record_id,
                        kind=cur.kind,
                        op="delete",
                        before=deepcopy(before_fields),
                        after=None,
                    )
                )
                await conn.execute(
                    delete(records).where(
                        records.c.story_id == story_id,
                        records.c.record_id == op.record_id,
                    )
                )
            elif isinstance(op, GuardRow):
                if op.record_id is None:
                    story_revision = working_story.revision
                    await conn.execute(
                        update(stories)
                        .where(stories.c.story_id == story_id)
                        .values(revision=working_story.revision)
                    )
                else:
                    cur = working_records[op.record_id]
                    new_revisions[op.record_id] = cur.revision
                    await conn.execute(
                        update(records)
                        .where(
                            records.c.story_id == story_id,
                            records.c.record_id == op.record_id,
                        )
                        .values(revision=cur.revision)
                    )

        await conn.execute(
            update(stories).where(stories.c.story_id == story_id).values(updated_at=now)
        )

        changes_json = [c.model_dump() for c in change_entries]
        await conn.execute(
            insert(commits).values(
                commit_id=commit_id,
                story_id=story_id,
                user_id=user_id,
                committed_at=now,
                source=source.source,
                thread_id=source.thread_id,
                run_id=source.run_id,
                tool_call_id=source.tool_call_id,
                reverts=list(source.reverts),
                changes=changes_json,
            )
        )

        return Saved(
            commit_id=commit_id,
            committed_at=now,
            story_revision=story_revision,
            revisions=new_revisions,
        )

    async def history(self, user_id: str, story_id: str) -> list[CommitRecord]:
        try:
            async with self._reads.connect() as conn:
                if not await self._story_owned(conn, user_id, story_id):
                    raise StoryNotFoundError(story_id)
                result = await conn.execute(
                    select(commits)
                    .where(commits.c.story_id == story_id)
                    .order_by(commits.c.seq.desc())
                )
                return [self._commit_from_row(r) for r in result]
        except OperationalError as exc:
            if _busy(exc):
                raise StoreBusyError from exc
            raise

    async def list_stories(self, user_id: str) -> list[StoryRow]:
        try:
            async with self._reads.connect() as conn:
                result = await conn.execute(
                    select(stories)
                    .where(stories.c.owner_id == user_id)
                    .order_by(stories.c.created_at)
                )
                return [_story_from_row(r) for r in result]
        except OperationalError as exc:
            if _busy(exc):
                raise StoreBusyError from exc
            raise

    async def delete(self, user_id: str, story_id: str) -> None:
        try:
            async with self._engine.begin() as conn:
                if not await self._story_owned(conn, user_id, story_id):
                    raise StoryNotFoundError(story_id)
                await conn.execute(
                    delete(stories).where(stories.c.story_id == story_id)
                )
        except OperationalError as exc:
            if _busy(exc):
                raise StoreBusyError from exc
            raise

    async def _fetch_story_row(
        self, conn: AsyncConnection, story_id: str
    ) -> Any | None:
        result = await conn.execute(
            select(stories).where(stories.c.story_id == story_id)
        )
        return result.first()

    async def _load_story(
        self, conn: AsyncConnection, user_id: str, story_id: str
    ) -> StoryRow:
        row = await self._fetch_story_row(conn, story_id)
        if row is None or row.owner_id != user_id:
            raise StoryNotFoundError(story_id)
        return _story_from_row(row)

    async def _story_owned(
        self, conn: AsyncConnection, user_id: str, story_id: str
    ) -> bool:
        row = await self._fetch_story_row(conn, story_id)
        return row is not None and row.owner_id == user_id

    def _commit_from_row(self, row: Any) -> CommitRecord:
        raw_changes: list[Any] = list(row.changes)
        changes = [Change.model_validate(c) for c in raw_changes]
        return CommitRecord(
            commit_id=row.commit_id,
            story_id=row.story_id,
            user_id=row.user_id,
            committed_at=_as_utc(row.committed_at),
            source=row.source,
            thread_id=row.thread_id,
            run_id=row.run_id,
            tool_call_id=row.tool_call_id,
            reverts=list(row.reverts),
            changes=changes,
        )


_: type[StoryStore] = SqlStoryStore
