"""The commit: load, apply, check, save."""

from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from pydantic import BaseModel, ConfigDict

from agentic_writing_system.stores.story_store import (
    CommitSource,
    Conflict,
    ConflictRow,
    CreateRow,
    DeleteRow,
    RowOp,
    Saved,
    StoredStory,
    StoryStore,
    UpdateRow,
)
from agentic_writing_system.story_bible.document import (
    document_from_stored,
    record_fields,
    record_from_row,
    record_kind,
    story_fields,
)
from agentic_writing_system.story_bible.records import (
    DOCUMENT_LISTS,
    SCHEMA_VERSION,
    Record,
    RecordKind,
    StoryDocument,
)
from agentic_writing_system.story_bible.rules import (
    Problem,
    Refusal,
    check_document,
    named_ids,
    story_named_ids,
)
from agentic_writing_system.story_bible.writes import (
    Applied,
    CreatedRecord,
    Write,
    apply_and_check,
    refusal_message,
)

_FORBID = ConfigDict(extra="forbid")


class Committed(BaseModel):
    model_config = _FORBID

    commit_id: str | None
    story_revision: int | None
    revisions: dict[str, int]
    deleted: list[str]
    created: list[CreatedRecord]


class CommitPlan(BaseModel):
    model_config = _FORBID

    changeset: list[RowOp]
    created: list[CreatedRecord]
    deleted: list[str]


def _find_record(document: StoryDocument, record_id: str) -> Record | None:
    for attr in DOCUMENT_LISTS.values():
        records: list[Record] = getattr(document, attr)
        for record in records:
            if record.id == record_id:
                return record
    return None


def _check_write_revisions(
    stored: StoredStory, writes: Sequence[Write]
) -> Conflict | None:
    by_id = {r.record_id: r for r in stored.records}
    rows: dict[str | None, ConflictRow] = {}

    for write in writes:
        if write.op == "set_story":
            if write.revision is None:
                continue
            if write.revision != stored.story.revision:
                if None not in rows:
                    rows[None] = ConflictRow(
                        record_id=None,
                        reason="revision_mismatch",
                        current=stored.story,
                    )
        elif write.op in ("update", "delete"):
            if write.revision is None:
                continue
            row = by_id.get(write.id)
            if row is None:
                if write.id not in rows:
                    rows[write.id] = ConflictRow(
                        record_id=write.id,
                        reason="missing",
                        current=None,
                    )
            elif row.revision != write.revision:
                if write.id not in rows:
                    rows[write.id] = ConflictRow(
                        record_id=write.id,
                        reason="revision_mismatch",
                        current=row,
                    )

    if not rows:
        return None
    return Conflict(rows=list(rows.values()))


def _build_changeset(
    stored: StoredStory,
    snapshot_doc: StoryDocument,
    applied: Applied,
) -> tuple[list[RowOp], list[str]] | Refusal:
    snapshot_by_id = {r.record_id: r for r in stored.records}
    result_doc = applied.document
    changeset: list[RowOp] = []
    deleted: list[str] = []

    for touched in applied.touched:
        if touched is None:
            before = story_fields(snapshot_doc)
            after = story_fields(result_doc)
            if before != after:
                changeset.append(
                    UpdateRow(
                        record_id=None,
                        expected_revision=stored.story.revision,
                        fields=after,
                        names=story_named_ids(result_doc),
                    )
                )
            continue

        snap_row = snapshot_by_id.get(touched)
        result_record = _find_record(result_doc, touched)

        if snap_row is None and result_record is not None:
            kind = record_kind(result_record)
            changeset.append(
                CreateRow(
                    record_id=touched,
                    kind=kind,
                    fields=record_fields(result_record),
                    names=named_ids(result_record),
                )
            )
        elif snap_row is not None and result_record is None:
            changeset.append(
                DeleteRow(record_id=touched, expected_revision=snap_row.revision)
            )
            deleted.append(touched)
        elif snap_row is not None and result_record is not None:
            snap_kind = cast(RecordKind, snap_row.kind)
            result_kind = record_kind(result_record)
            if snap_kind != result_kind:
                return Refusal(
                    message=(
                        f"Record {touched} cannot change kind from "
                        f"{snap_kind} to {result_kind}."
                    ),
                    problems=[
                        Problem(
                            code="kind_changed",
                            message=(
                                f"Record {touched} cannot change kind from "
                                f"{snap_kind} to {result_kind}."
                            ),
                            record_id=touched,
                        )
                    ],
                )
            before_fields = record_fields(record_from_row(snap_row))
            after_fields = record_fields(result_record)
            if before_fields != after_fields:
                changeset.append(
                    UpdateRow(
                        record_id=touched,
                        expected_revision=snap_row.revision,
                        fields=after_fields,
                        names=named_ids(result_record),
                    )
                )

    return changeset, deleted


def plan_commit(
    stored: StoredStory, writes: Sequence[Write]
) -> CommitPlan | Refusal | Conflict:
    snapshot_doc = document_from_stored(stored)
    conflict = _check_write_revisions(stored, writes)
    if conflict is not None:
        return conflict
    applied = apply_and_check(snapshot_doc, writes)
    if isinstance(applied, Refusal):
        return applied
    built = _build_changeset(stored, snapshot_doc, applied)
    if isinstance(built, Refusal):
        return built
    changeset, deleted = built
    return CommitPlan(changeset=changeset, created=applied.created, deleted=deleted)


async def commit(
    store: StoryStore,
    user_id: str,
    story_id: str,
    writes: Sequence[Write],
    source: CommitSource,
) -> Committed | Refusal | Conflict:
    stored = await store.load(user_id, story_id)
    plan = plan_commit(stored, writes)
    if isinstance(plan, Refusal | Conflict):
        return plan
    if not plan.changeset:
        return Committed(
            commit_id=None,
            story_revision=None,
            revisions={},
            deleted=plan.deleted,
            created=plan.created,
        )
    outcome = await store.save(user_id, story_id, plan.changeset, source)
    if isinstance(outcome, Conflict):
        return outcome
    assert isinstance(outcome, Saved)
    return Committed(
        commit_id=outcome.commit_id,
        story_revision=outcome.story_revision,
        revisions=dict(outcome.revisions),
        deleted=plan.deleted,
        created=plan.created,
    )


def check_import(document: StoryDocument) -> Refusal | None:
    if document.schema_version != SCHEMA_VERSION:
        return Refusal(
            message=(
                f"The file's schema version is {document.schema_version}; "
                f"this application reads version {SCHEMA_VERSION}."
            ),
            problems=[
                Problem(
                    code="schema_version",
                    message=(
                        f"The file's schema version is {document.schema_version}; "
                        f"this application reads version {SCHEMA_VERSION}."
                    ),
                )
            ],
        )
    problems = check_document(document)
    if problems:
        return Refusal(message=refusal_message(problems), problems=problems)
    return None


def import_changeset(story_revision: int, document: StoryDocument) -> list[RowOp]:
    ops: list[RowOp] = []
    for kind in DOCUMENT_LISTS:
        for record in getattr(document, DOCUMENT_LISTS[kind]):
            ops.append(
                CreateRow(
                    record_id=record.id,
                    kind=kind,
                    fields=record_fields(record),
                    names=named_ids(record),
                )
            )
    if story_fields(document) != story_fields(StoryDocument()):
        ops.append(
            UpdateRow(
                record_id=None,
                expected_revision=story_revision,
                fields=story_fields(document),
                names=story_named_ids(document),
            )
        )
    return ops


async def import_story(
    store: StoryStore, user_id: str, document: StoryDocument
) -> str | Refusal:
    refusal = check_import(document)
    if refusal is not None:
        return refusal
    story_row = await store.create(user_id)
    changeset = import_changeset(story_row.revision, document)
    if changeset:
        outcome = await store.save(
            user_id,
            story_row.story_id,
            changeset,
            CommitSource(source="import"),
        )
        if isinstance(outcome, Conflict):
            await store.delete(user_id, story_row.story_id)
            msg = "import conflict on an otherwise unused story"
            raise RuntimeError(msg)
    return story_row.story_id
