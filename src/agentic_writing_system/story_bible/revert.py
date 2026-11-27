"""Undo commits by applying their inverse to a copy of the story.

A revert does not go through ``apply_writes``. A create write mints a new id,
and undoing a delete has to put the original id back.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from agentic_writing_system.stores.story_store import (
    Change,
    CommitRecord,
    CommitSource,
    Conflict,
    ConflictRow,
    RecordRow,
    Saved,
    StoredStory,
    StoryStore,
)
from agentic_writing_system.story_bible.commit import (
    CommitPlan,
    Committed,
    build_changeset,
)
from agentic_writing_system.story_bible.document import (
    document_from_stored,
    record_fields,
    story_fields,
)
from agentic_writing_system.story_bible.records import (
    DOCUMENT_LISTS,
    RECORD_MODELS,
    Record,
    RecordKind,
    StoryDocument,
    StoryFields,
)
from agentic_writing_system.story_bible.rules import (
    Problem,
    Refusal,
    check_document,
)
from agentic_writing_system.story_bible.writes import (
    Applied,
    CreatedRecord,
    refusal_message,
)

type _Touch = Callable[[str | None], None]


def plan_revert(
    stored: StoredStory, commits: Sequence[CommitRecord]
) -> CommitPlan | Refusal | Conflict:
    """The changeset that undoes ``commits``, or the reason it cannot.

    Commits are undone newest first, whatever order they are given in. Each
    commit's changes are undone from last to first, against the document the
    previous inverse left. A failed precondition is a conflict and nothing is
    planned. When every inverse applies, the result is checked with the same
    rules as a commit.
    """
    document = document_from_stored(stored)
    doc = document.model_copy(deep=True)
    conflicts: dict[str | None, ConflictRow] = {}
    touched: list[str | None] = []
    seen: set[str | None] = set()

    def touch(record_id: str | None) -> None:
        if record_id not in seen:
            seen.add(record_id)
            touched.append(record_id)

    ordered = _unique_newest_first(commits)
    for commit in ordered:
        for change in reversed(commit.changes):
            doc = _invert(doc, stored, change, conflicts, touch)

    if conflicts:
        return Conflict(rows=list(conflicts.values()))

    snapshot_ids = {row.record_id for row in stored.records}
    result_ids = _ids(doc)
    deleted_ids = [
        row.record_id for row in stored.records if row.record_id not in result_ids
    ]
    problems = check_document(doc, deleted_ids)
    if problems:
        return Refusal(message=refusal_message(problems), problems=problems)

    created = _created(doc, touched, snapshot_ids)
    applied = Applied(
        document=doc,
        created=created,
        touched=touched,
        deleted_ids=deleted_ids,
    )
    built = build_changeset(stored, document, applied)
    if isinstance(built, Refusal):
        return built
    changeset, deleted = built
    return CommitPlan(changeset=changeset, created=created, deleted=deleted)


async def revert(
    store: StoryStore,
    user_id: str,
    story_id: str,
    commit_ids: Sequence[str],
) -> Committed | Refusal | Conflict:
    """Undo the named commits and save that as one revert commit.

    A commit id that is not in this story is a refusal, and nothing is written.
    The store's own conflict check is the race guard around the save.
    """
    stored = await store.load(user_id, story_id)
    history = await store.history(user_id, story_id)
    by_id = {record.commit_id: record for record in history}
    unique = _unique_ids(commit_ids)
    unknown = [commit_id for commit_id in unique if commit_id not in by_id]
    if unknown:
        return _unknown_commits(unknown)

    commits = [by_id[commit_id] for commit_id in unique]
    plan = plan_revert(stored, commits)
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
    undone = [commit.commit_id for commit in _unique_newest_first(commits)]
    outcome = await store.save(
        user_id,
        story_id,
        plan.changeset,
        CommitSource(source="revert", reverts=undone),
    )
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


def _unique_ids(commit_ids: Sequence[str]) -> list[str]:
    """The ids once each, in the order they were given.

    Undoing one commit twice in the same request would fail the second time,
    because the first inverse has already moved the story.
    """
    seen: list[str] = []
    for commit_id in commit_ids:
        if commit_id not in seen:
            seen.append(commit_id)
    return seen


def _unique_newest_first(commits: Sequence[CommitRecord]) -> list[CommitRecord]:
    seen: set[str] = set()
    unique: list[CommitRecord] = []
    for commit in commits:
        if commit.commit_id in seen:
            continue
        seen.add(commit.commit_id)
        unique.append(commit)
    return sorted(unique, key=lambda commit: commit.committed_at, reverse=True)


def _unknown_commits(ids: list[str]) -> Refusal:
    if len(ids) == 1:
        message = f"No commit {ids[0]} in this story."
    else:
        message = f"No commits {', '.join(ids)} in this story."
    return Refusal(
        message=message,
        problems=[
            Problem(code="unknown_commit", message=message, ids=list(ids)),
        ],
    )


def _invert(
    doc: StoryDocument,
    stored: StoredStory,
    change: Change,
    conflicts: dict[str | None, ConflictRow],
    touch: _Touch,
) -> StoryDocument:
    if change.record_id is None or change.kind == "story":
        return _invert_story(doc, stored, change, conflicts, touch)
    record_id = change.record_id
    if change.op == "delete":
        return _invert_delete(doc, stored, change, record_id, conflicts, touch)
    return _invert_present(doc, stored, change, record_id, conflicts, touch)


def _invert_story(
    doc: StoryDocument,
    stored: StoredStory,
    change: Change,
    conflicts: dict[str | None, ConflictRow],
    touch: _Touch,
) -> StoryDocument:
    if story_fields(doc) != (change.after or {}):
        _add(
            conflicts,
            ConflictRow(
                record_id=None,
                reason="revision_mismatch",
                current=stored.story,
            ),
        )
        return doc
    restored = StoryFields.model_validate(change.before or {})
    touch(None)
    return doc.model_copy(update=restored.model_dump())


def _invert_present(
    doc: StoryDocument,
    stored: StoredStory,
    change: Change,
    record_id: str,
    conflicts: dict[str | None, ConflictRow],
    touch: _Touch,
) -> StoryDocument:
    """Undo a create or an update. The record must still match ``after``."""
    found = _find(doc, record_id)
    if found is None:
        stored_row = _stored_record(stored, record_id)
        _add(
            conflicts,
            ConflictRow(
                record_id=record_id,
                reason="missing" if stored_row is None else "revision_mismatch",
                current=stored_row,
            ),
        )
        return doc
    kind, record = found
    expected = _as_kind(change.kind)
    if expected is None or kind != expected or not _same_fields(record, change.after):
        _add(
            conflicts,
            ConflictRow(
                record_id=record_id,
                reason="revision_mismatch",
                current=_current(stored, record_id, record, kind),
            ),
        )
        return doc
    touch(record_id)
    if change.op == "create":
        return _remove(doc, record_id)
    return _replace(doc, kind, record_id, change.before or {})


def _invert_delete(
    doc: StoryDocument,
    stored: StoredStory,
    change: Change,
    record_id: str,
    conflicts: dict[str | None, ConflictRow],
    touch: _Touch,
) -> StoryDocument:
    """Undo a delete. The id must be free, and the record comes back from ``before``."""
    found = _find(doc, record_id)
    if found is not None:
        kind, record = found
        _add(
            conflicts,
            ConflictRow(
                record_id=record_id,
                reason="already_exists",
                current=_current(stored, record_id, record, kind),
            ),
        )
        return doc
    restored_kind = _as_kind(change.kind)
    if restored_kind is None or change.before is None:
        _add(
            conflicts,
            ConflictRow(
                record_id=record_id,
                reason="missing",
                current=_stored_record(stored, record_id),
            ),
        )
        return doc
    touch(record_id)
    return _insert(doc, restored_kind, record_id, change.before)


def _same_fields(record: Record, after: dict[str, Any] | None) -> bool:
    if after is None:
        return False
    return record_fields(record) == after


def _add(conflicts: dict[str | None, ConflictRow], row: ConflictRow) -> None:
    if row.record_id not in conflicts:
        conflicts[row.record_id] = row


def _stored_record(stored: StoredStory, record_id: str) -> RecordRow | None:
    for row in stored.records:
        if row.record_id == record_id:
            return row
    return None


def _current(
    stored: StoredStory,
    record_id: str,
    record: Record,
    kind: RecordKind,
) -> RecordRow:
    """The stored row when it exists, otherwise the working record's fields."""
    stored_row = _stored_record(stored, record_id)
    if stored_row is not None:
        return stored_row
    return RecordRow(
        record_id=record_id,
        kind=kind,
        fields=record_fields(record),
        names=[],
        revision=1,
    )


def _find(doc: StoryDocument, record_id: str) -> tuple[RecordKind, Record] | None:
    for kind, attr in DOCUMENT_LISTS.items():
        records: list[Record] = getattr(doc, attr)
        for record in records:
            if record.id == record_id:
                return kind, record
    return None


def _remove(doc: StoryDocument, record_id: str) -> StoryDocument:
    for attr in DOCUMENT_LISTS.values():
        records: list[Record] = list(getattr(doc, attr))
        kept = [record for record in records if record.id != record_id]
        if len(kept) != len(records):
            return doc.model_copy(update={attr: kept})
    return doc


def _replace(
    doc: StoryDocument,
    kind: RecordKind,
    record_id: str,
    fields: dict[str, Any],
) -> StoryDocument:
    model = RECORD_MODELS[kind]
    restored = model.model_validate({**fields, "id": record_id})
    attr = DOCUMENT_LISTS[kind]
    records: list[Record] = [
        restored if record.id == record_id else record for record in getattr(doc, attr)
    ]
    return doc.model_copy(update={attr: records})


def _insert(
    doc: StoryDocument,
    kind: RecordKind,
    record_id: str,
    fields: dict[str, Any],
) -> StoryDocument:
    model = RECORD_MODELS[kind]
    restored = model.model_validate({**fields, "id": record_id})
    attr = DOCUMENT_LISTS[kind]
    records: list[Record] = [*getattr(doc, attr), restored]
    return doc.model_copy(update={attr: records})


def _ids(doc: StoryDocument) -> set[str]:
    found: set[str] = set()
    for attr in DOCUMENT_LISTS.values():
        records: list[Record] = getattr(doc, attr)
        for record in records:
            found.add(record.id)
    return found


def _created(
    doc: StoryDocument,
    touched: Sequence[str | None],
    snapshot_ids: set[str],
) -> list[CreatedRecord]:
    created: list[CreatedRecord] = []
    for record_id in touched:
        if record_id is None or record_id in snapshot_ids:
            continue
        found = _find(doc, record_id)
        if found is None:
            continue
        kind, _record = found
        created.append(CreatedRecord(kind=kind, id=record_id, ref=None))
    return created


def _as_kind(kind: str) -> RecordKind | None:
    if kind in DOCUMENT_LISTS:
        return kind
    return None
