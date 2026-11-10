"""The story store interface.

This is the adapter interface from docs/architecture/persistence.md, "Story store".
The Story Bible layer codes against it and never opens an engine. An adapter knows
rows, revisions, and which rows name which other rows. It does not know the Story
Bible's rules, and it never reads `fields` to find a name: the caller passes `names`.

A story is one story row and one row per record. In every type below, a
`record_id` of `None` means the story row.
"""

from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


# --- Rows -------------------------------------------------------------------


class StoryRow(_Model):
    """The story row: framing fields and `unit_ids` live in `fields`."""

    story_id: str
    owner_id: str
    schema_version: int
    fields: dict[str, Any]
    names: list[str]
    revision: int
    created_at: datetime
    updated_at: datetime


class RecordRow(_Model):
    """One Story Bible record. `kind` is opaque to the store."""

    record_id: str
    kind: str
    fields: dict[str, Any]
    names: list[str]
    revision: int


class StoredStory(_Model):
    """A consistent snapshot from one `load`. Records are in creation order."""

    story: StoryRow
    records: list[RecordRow]


# --- Changeset --------------------------------------------------------------


class CreateRow(_Model):
    """Insert a record row at revision 1. The row must not exist."""

    op: Literal["create"] = "create"
    record_id: str
    kind: str
    fields: dict[str, Any]
    names: list[str]


class UpdateRow(_Model):
    """Replace a row's fields and names. Revision moves by one."""

    op: Literal["update"] = "update"
    record_id: str | None
    expected_revision: int
    fields: dict[str, Any]
    names: list[str]


class DeleteRow(_Model):
    """Remove a record row. The story row is removed only by `delete`."""

    op: Literal["delete"] = "delete"
    record_id: str
    expected_revision: int


class GuardRow(_Model):
    """Change nothing in the row. Revision moves by one."""

    op: Literal["guard"] = "guard"
    record_id: str | None
    expected_revision: int


RowOp = Annotated[
    CreateRow | UpdateRow | DeleteRow | GuardRow, Field(discriminator="op")
]


# --- Commit history ---------------------------------------------------------

SourceKind = Literal["user", "tool", "import", "draft", "revert", "eval"]


class CommitSource(_Model):
    """Where a change came from. Written on the commit record."""

    source: SourceKind
    thread_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    reverts: list[str] = []


class Change(_Model):
    """One created, updated, or deleted row, with its fields before and after.

    A create has no `before`. A delete has no `after`. `kind` is `"story"` for
    the story row. Guards are not changes.
    """

    record_id: str | None
    kind: str
    op: Literal["create", "update", "delete"]
    before: dict[str, Any] | None
    after: dict[str, Any] | None


class CommitRecord(_Model):
    commit_id: str
    story_id: str
    user_id: str
    committed_at: datetime
    source: SourceKind
    thread_id: str | None
    run_id: str | None
    tool_call_id: str | None
    reverts: list[str]
    changes: list[Change]


# --- Save outcomes ----------------------------------------------------------


class Saved(_Model):
    """The changeset landed.

    `revisions` has the new revision of every record row the save created,
    updated, or guarded. `story_revision` is the story row's new revision when
    the changeset updated or guarded it, and `None` when it did not touch it.
    """

    commit_id: str
    committed_at: datetime
    story_revision: int | None
    revisions: dict[str, int]


ConflictReason = Literal[
    "revision_mismatch", "already_exists", "missing", "dangling_name"
]


class ConflictRow(_Model):
    """One row that kept the changeset from landing.

    - `revision_mismatch`: an update, delete, or guard expected another revision.
    - `already_exists`: a create found the row.
    - `missing`: an update, delete, or guard found no row.
    - `dangling_name`: after the operations, this row would name ids that are not
      rows of this story. `missing_names` lists them.

    `current` is the row as stored now, after the save rolled back, or `None`
    when the row does not exist.
    """

    record_id: str | None
    reason: ConflictReason
    current: RecordRow | StoryRow | None
    missing_names: list[str] = []


class Conflict(_Model):
    """Nothing landed. Every row that failed a guard or the name check is listed."""

    rows: list[ConflictRow]


# --- Errors -----------------------------------------------------------------


class StoryNotFoundError(Exception):
    """The story does not exist, or the acting user does not own it."""


class StoreBusyError(Exception):
    """The engine stayed busy past its timeout. The caller may try again."""


# --- The interface ----------------------------------------------------------


class StoryStore(Protocol):
    """Six operations. Every one takes the acting user's id.

    `load`, `save`, `history`, and `delete` raise `StoryNotFoundError` for a story
    the acting user does not own. Any operation may raise `StoreBusyError`.
    """

    async def create(self, user_id: str) -> StoryRow:
        """A new empty story owned by `user_id`: empty `fields`, revision 1."""
        ...

    async def load(self, user_id: str, story_id: str) -> StoredStory:
        """Every row of the story, read in one transaction."""
        ...

    async def save(
        self,
        user_id: str,
        story_id: str,
        changeset: Sequence[RowOp],
        source: CommitSource,
    ) -> Saved | Conflict:
        """Apply the changeset and write its commit record, as one transaction.

        Every guard is checked and every operation applied, or none is. After the
        operations, every id any row of this story names must be a record row of
        this story; a row that fails is a `dangling_name` conflict. The commit
        record's changes are in changeset order, with each `before` taken from
        the row this transaction read.

        A changeset that is empty, or has two operations on one row, is a caller
        bug and raises `ValueError`.
        """
        ...

    async def history(self, user_id: str, story_id: str) -> list[CommitRecord]:
        """The story's commit records, newest first."""
        ...

    async def list_stories(self, user_id: str) -> list[StoryRow]:
        """The acting user's story rows, oldest first."""
        ...

    async def delete(self, user_id: str, story_id: str) -> None:
        """Remove the story, its record rows, and its commit records."""
        ...
