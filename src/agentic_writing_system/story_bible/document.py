"""Conversion between store rows and Story Bible document models."""

from __future__ import annotations

from typing import Any, cast

from agentic_writing_system.stores.story_store import RecordRow, StoredStory
from agentic_writing_system.story_bible.records import (
    RECORD_MODELS,
    Arc,
    Assertion,
    Entity,
    Event,
    NarrativeUnit,
    Property,
    Record,
    RecordKind,
    StoryDocument,
    StoryFields,
)

_KIND_FOR_TYPE: dict[type[Record], RecordKind] = {
    Entity: "entity",
    Property: "property",
    Assertion: "assertion",
    Event: "event",
    NarrativeUnit: "unit",
    Arc: "arc",
}


def record_from_row(row: RecordRow) -> Record:
    kind = cast(RecordKind, row.kind)
    model = RECORD_MODELS[kind]
    # Rows saved while `supersedes` existed still carry the key. The field is gone.
    fields = {key: value for key, value in row.fields.items() if key != "supersedes"}
    return model.model_validate({**fields, "id": row.record_id})


def record_fields(record: Record) -> dict[str, Any]:
    data = record.model_dump(mode="json")
    del data["id"]
    return data


def record_kind(record: Record) -> RecordKind:
    return _KIND_FOR_TYPE[type(record)]


def story_fields(document: StoryDocument) -> dict[str, Any]:
    framing = StoryFields(
        title=document.title,
        description=document.description,
        premise=document.premise,
        tone=document.tone,
        themes=document.themes,
        writing_style=document.writing_style,
        unit_ids=list(document.unit_ids),
    )
    return framing.model_dump(mode="json")


def document_from_stored(stored: StoredStory) -> StoryDocument:
    framing = StoryFields.model_validate(stored.story.fields)
    entities: list[Entity] = []
    properties: list[Property] = []
    assertions: list[Assertion] = []
    events: list[Event] = []
    units: list[NarrativeUnit] = []
    arcs: list[Arc] = []
    for row in stored.records:
        kind = cast(RecordKind, row.kind)
        record = record_from_row(row)
        match kind:
            case "entity":
                entities.append(cast(Entity, record))
            case "property":
                properties.append(cast(Property, record))
            case "assertion":
                assertions.append(cast(Assertion, record))
            case "event":
                events.append(cast(Event, record))
            case "unit":
                units.append(cast(NarrativeUnit, record))
            case "arc":
                arcs.append(cast(Arc, record))
    return StoryDocument(
        schema_version=stored.story.schema_version,
        title=framing.title,
        description=framing.description,
        premise=framing.premise,
        tone=framing.tone,
        themes=framing.themes,
        writing_style=framing.writing_style,
        unit_ids=list(framing.unit_ids),
        entities=entities,
        properties=properties,
        assertions=assertions,
        events=events,
        units=units,
        arcs=arcs,
    )
