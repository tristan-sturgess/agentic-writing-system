"""Response models for story endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Self, cast

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic_core import PydanticCustomError

from agentic_writing_system.stores.story_store import (
    Conflict,
    ConflictReason,
    ConflictRow,
    RecordRow,
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


class StorySummary(BaseModel):
    model_config = _FORBID

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class EntityView(Entity):
    revision: int


class PropertyView(Property):
    revision: int


class AssertionView(Assertion):
    revision: int


class EventView(Event):
    revision: int


class NarrativeUnitView(NarrativeUnit):
    revision: int


class ArcView(Arc):
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
    model_config = _FORBID

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
