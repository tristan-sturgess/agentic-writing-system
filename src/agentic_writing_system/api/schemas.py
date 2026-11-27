"""Response models for story endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Self, cast

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic_core import PydanticCustomError

from agentic_writing_system.stores.story_store import (
    CommitRecord,
    Conflict,
    ConflictReason,
    ConflictRow,
    RecordRow,
    SourceKind,
    StoredStory,
    StoryRow,
)
from agentic_writing_system.story_bible.document import (
    document_from_stored,
    record_from_row,
)
from agentic_writing_system.story_bible.records import (
    Arc,
    Assertion,
    Entity,
    Event,
    NarrativeUnit,
    Property,
    RecordKind,
)
from agentic_writing_system.story_bible.writes import Write

_FORBID = ConfigDict(extra="forbid")

# A story response carries every field, the ones with a default included. This
# makes the OpenAPI document say so. Without it the document lists a defaulted
# field as optional, as it is in a request, and the frontend's generated types
# would have to guard for a field that is always there.
_SENT_WHOLE = ConfigDict(
    extra="forbid", json_schema_serialization_defaults_required=True
)


class StorySummary(BaseModel):
    model_config = _FORBID

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class EntityView(Entity):
    model_config = _SENT_WHOLE

    revision: int


class PropertyView(Property):
    model_config = _SENT_WHOLE

    revision: int


class AssertionView(Assertion):
    model_config = _SENT_WHOLE

    revision: int


class EventView(Event):
    model_config = _SENT_WHOLE

    revision: int


class NarrativeUnitView(NarrativeUnit):
    model_config = _SENT_WHOLE

    revision: int


class ArcView(Arc):
    model_config = _SENT_WHOLE

    revision: int


type RecordView = (
    EntityView | PropertyView | AssertionView | EventView | NarrativeUnitView | ArcView
)

_RECORD_VIEWS: dict[RecordKind, type[RecordView]] = {
    "entity": EntityView,
    "property": PropertyView,
    "assertion": AssertionView,
    "event": EventView,
    "unit": NarrativeUnitView,
    "arc": ArcView,
}


def record_view(row: RecordRow) -> RecordView:
    kind = cast(RecordKind, row.kind)
    view_cls = _RECORD_VIEWS[kind]
    record = record_from_row(row)
    return view_cls(**record.model_dump(), revision=row.revision)


class StoryView(BaseModel):
    model_config = _SENT_WHOLE

    id: str
    schema_version: int
    revision: int
    created_at: datetime
    updated_at: datetime
    title: str = ""
    description: str = ""
    premise: str = ""
    tone: str = ""
    themes: str = ""
    writing_style: str = ""
    unit_ids: list[str] = Field(default_factory=list)
    entities: list[EntityView] = Field(default_factory=list)
    properties: list[PropertyView] = Field(default_factory=list)
    assertions: list[AssertionView] = Field(default_factory=list)
    events: list[EventView] = Field(default_factory=list)
    units: list[NarrativeUnitView] = Field(default_factory=list)
    arcs: list[ArcView] = Field(default_factory=list)


def story_summary(row: StoryRow) -> StorySummary:
    raw_title = row.fields.get("title", "")
    title = raw_title if isinstance(raw_title, str) else ""
    return StorySummary(
        id=row.story_id,
        title=title,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class RevertRequest(BaseModel):
    """The commits to undo. An empty list is a schema error."""

    model_config = _FORBID

    commit_ids: list[str] = Field(min_length=1)


class CommitRequest(BaseModel):
    model_config = _FORBID

    writes: list[Write] = Field(min_length=1)

    @model_validator(mode="after")
    def check_write_revisions(self) -> Self:
        for index, write in enumerate(self.writes):
            if write.op == "set_story":
                if write.revision is None:
                    raise PydanticCustomError(
                        "missing_revision",
                        "Write {index}: set_story must carry a revision",
                        {"index": index},
                    )
            elif write.op in ("update", "delete"):
                if write.id.startswith("@"):
                    if write.revision is not None:
                        raise PydanticCustomError(
                            "ref_revision",
                            (
                                "Write {index}: update or delete whose id is a ref "
                                "must not carry a revision"
                            ),
                            {"index": index},
                        )
                elif write.revision is None:
                    raise PydanticCustomError(
                        "missing_revision",
                        "Write {index}: update or delete must carry a revision",
                        {"index": index},
                    )
        return self


class ConflictRowView(BaseModel):
    model_config = _FORBID

    id: str | None
    kind: str | None
    reason: ConflictReason
    revision: int | None = None
    fields: dict[str, Any] | None = None
    missing_names: list[str] = Field(default_factory=list)


class ConflictResponse(BaseModel):
    model_config = _FORBID

    rows: list[ConflictRowView]


def conflict_row_view(row: ConflictRow) -> ConflictRowView:
    current = row.current
    if current is None:
        return ConflictRowView(
            id=row.record_id,
            kind=None,
            reason=row.reason,
            revision=None,
            fields=None,
            missing_names=list(row.missing_names),
        )
    if isinstance(current, StoryRow):
        return ConflictRowView(
            id=None,
            kind="story",
            reason=row.reason,
            revision=current.revision,
            fields=dict(current.fields),
            missing_names=list(row.missing_names),
        )
    assert isinstance(current, RecordRow)
    return ConflictRowView(
        id=row.record_id,
        kind=current.kind,
        reason=row.reason,
        revision=current.revision,
        fields=dict(current.fields),
        missing_names=list(row.missing_names),
    )


def conflict_response(conflict: Conflict) -> ConflictResponse:
    return ConflictResponse(rows=[conflict_row_view(r) for r in conflict.rows])


class ChangeView(BaseModel):
    """One change in a commit record. A create has no before; a delete has no after."""

    model_config = _SENT_WHOLE

    record_id: str | None
    kind: str
    op: Literal["create", "update", "delete"]
    before: dict[str, Any] | None
    after: dict[str, Any] | None


class CommitView(BaseModel):
    """A commit record without `user_id` and `story_id`."""

    model_config = _SENT_WHOLE

    commit_id: str
    committed_at: datetime
    source: SourceKind
    thread_id: str | None
    run_id: str | None
    tool_call_id: str | None
    reverts: list[str]
    changes: list[ChangeView]


def commit_view(record: CommitRecord) -> CommitView:
    return CommitView.model_validate(record.model_dump(exclude={"user_id", "story_id"}))


def story_view(stored: StoredStory) -> StoryView:
    doc = document_from_stored(stored)
    story = stored.story
    entities: list[EntityView] = []
    properties: list[PropertyView] = []
    assertions: list[AssertionView] = []
    events: list[EventView] = []
    units: list[NarrativeUnitView] = []
    arcs: list[ArcView] = []
    for row in stored.records:
        kind = cast(RecordKind, row.kind)
        view = record_view(row)
        match kind:
            case "entity":
                entities.append(cast(EntityView, view))
            case "property":
                properties.append(cast(PropertyView, view))
            case "assertion":
                assertions.append(cast(AssertionView, view))
            case "event":
                events.append(cast(EventView, view))
            case "unit":
                units.append(cast(NarrativeUnitView, view))
            case "arc":
                arcs.append(cast(ArcView, view))
    return StoryView(
        id=story.story_id,
        schema_version=story.schema_version,
        revision=story.revision,
        created_at=story.created_at,
        updated_at=story.updated_at,
        title=doc.title,
        description=doc.description,
        premise=doc.premise,
        tone=doc.tone,
        themes=doc.themes,
        writing_style=doc.writing_style,
        unit_ids=list(doc.unit_ids),
        entities=entities,
        properties=properties,
        assertions=assertions,
        events=events,
        units=units,
        arcs=arcs,
    )
