"""Pydantic models for the flat Story Bible document and its records."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Annotated, Any, Literal, overload

from pydantic import BaseModel, ConfigDict, Discriminator, Field, Tag
from pydantic.functional_validators import AfterValidator

SCHEMA_VERSION = 1

RecordKind = Literal["entity", "property", "assertion", "event", "unit", "arc"]

_FORBID = ConfigDict(extra="forbid")

_DATE_ONLY_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_DATETIME_MIN_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$")
_DATETIME_SEC_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$")


def _validate_story_timestamp(value: str) -> str:
    year: int
    if match := _DATE_ONLY_RE.match(value):
        year = int(match.group(1))
        month = int(match.group(2))
        day = int(match.group(3))
        if not 1 <= year <= 9999:
            msg = "year must be between 0001 and 9999"
            raise ValueError(msg)
        date(year, month, day)
        return value
    if match := _DATETIME_MIN_RE.match(value):
        year = int(match.group(1))
        if not 1 <= year <= 9999:
            msg = "year must be between 0001 and 9999"
            raise ValueError(msg)
        datetime.strptime(value, "%Y-%m-%dT%H:%M")
        return value
    if match := _DATETIME_SEC_RE.match(value):
        year = int(match.group(1))
        if not 1 <= year <= 9999:
            msg = "year must be between 0001 and 9999"
            raise ValueError(msg)
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%S")
        return value
    msg = (
        "timestamp must be YYYY-MM-DD, YYYY-MM-DDTHH:MM, or YYYY-MM-DDTHH:MM:SS "
        "with no time zone"
    )
    raise ValueError(msg)


StoryTimestamp = Annotated[str, AfterValidator(_validate_story_timestamp)]


def timestamp_value(timestamp: str) -> datetime:
    """The moment a story timestamp names. A date alone is the start of that day."""
    return datetime.fromisoformat(timestamp)


class TimestampPoint(BaseModel):
    model_config = _FORBID

    timestamp: StoryTimestamp


class EventPoint(BaseModel):
    model_config = _FORBID

    event_id: str
    # Left out is stored and returned as null. The rules say what that means.
    edge: Literal["start", "end"] | None = None


def _time_point_shape(value: Any) -> str | None:
    """Which shape a time point is, from the one key it carries.

    Validating only that shape gives one error for one mistake. A plain union
    would try both shapes and report the failures of each.
    """
    if isinstance(value, TimestampPoint):
        return "timestamp"
    if isinstance(value, EventPoint):
        return "event_id"
    if isinstance(value, dict):
        keys = [key for key in ("timestamp", "event_id") if key in value]
        if len(keys) == 1:
            return keys[0]
    return None


TimePoint = Annotated[
    Annotated[TimestampPoint, Tag("timestamp")]
    | Annotated[EventPoint, Tag("event_id")],
    Discriminator(
        _time_point_shape,
        custom_error_type="time_point_shape",
        custom_error_message="A time point has exactly one of timestamp or event_id",
    ),
]


class AtSpan(BaseModel):
    model_config = _FORBID

    kind: Literal["at"] = "at"
    at: TimePoint


class RangeSpan(BaseModel):
    model_config = _FORBID

    kind: Literal["range"] = "range"
    start: TimePoint | None = None
    end: TimePoint | None = None


Span = Annotated[
    AtSpan | RangeSpan,
    Field(discriminator="kind"),
]


def _validate_record_id(value: str) -> str:
    if not value:
        msg = "id must be non-empty"
        raise ValueError(msg)
    if any(ch.isspace() for ch in value):
        msg = "id must not contain whitespace"
        raise ValueError(msg)
    if value.startswith("@"):
        msg = "id must not start with @"
        raise ValueError(msg)
    return value


RecordId = Annotated[str, AfterValidator(_validate_record_id)]


class _RecordBase(BaseModel):
    model_config = _FORBID


# --- Entity -----------------------------------------------------------------


class EntityFields(_RecordBase):
    name: str
    notes: str = ""


class Entity(EntityFields):
    id: RecordId


class EntityPatch(_RecordBase):
    name: str = ""
    notes: str = ""


# --- Property ---------------------------------------------------------------


class PropertyFields(_RecordBase):
    entity_id: str
    statement: str
    when: list[Span] = Field(default_factory=list)
    caused_by: str | None = None
    supersedes: str | None = None


class Property(PropertyFields):
    id: RecordId


class PropertyPatch(_RecordBase):
    entity_id: str = ""
    statement: str = ""
    when: list[Span] = Field(default_factory=list)
    caused_by: str | None = None
    supersedes: str | None = None


# --- Assertion --------------------------------------------------------------


class AssertionFields(_RecordBase):
    entity_ids: list[str] = Field(default_factory=list)
    event_ids: list[str] = Field(default_factory=list)
    arc_ids: list[str] = Field(default_factory=list)
    statement: str
    when: list[Span] = Field(default_factory=list)
    caused_by: str | None = None
    supersedes: str | None = None


class Assertion(AssertionFields):
    id: RecordId


class AssertionPatch(_RecordBase):
    entity_ids: list[str] = Field(default_factory=list)
    event_ids: list[str] = Field(default_factory=list)
    arc_ids: list[str] = Field(default_factory=list)
    statement: str = ""
    when: list[Span] = Field(default_factory=list)
    caused_by: str | None = None
    supersedes: str | None = None


# --- Event ------------------------------------------------------------------


class EventFields(_RecordBase):
    title: str
    description: str = ""
    entity_ids: list[str] = Field(default_factory=list)
    when: list[Span] = Field(default_factory=list)


class Event(EventFields):
    id: RecordId


class EventPatch(_RecordBase):
    title: str = ""
    description: str = ""
    entity_ids: list[str] = Field(default_factory=list)
    when: list[Span] = Field(default_factory=list)


# --- Narrative unit ---------------------------------------------------------


class NarrativeUnitFields(_RecordBase):
    title: str
    summary: str = ""
    notes: str = ""
    child_ids: list[str] = Field(default_factory=list)
    subject_ids: list[str] = Field(default_factory=list)
    prose: str = ""


class NarrativeUnit(NarrativeUnitFields):
    id: RecordId


class NarrativeUnitPatch(_RecordBase):
    title: str = ""
    summary: str = ""
    notes: str = ""
    child_ids: list[str] = Field(default_factory=list)
    subject_ids: list[str] = Field(default_factory=list)
    prose: str = ""


# --- Arc --------------------------------------------------------------------


class ArcFields(_RecordBase):
    title: str
    description: str = ""
    event_ids: list[str] = Field(default_factory=list)


class Arc(ArcFields):
    id: RecordId


class ArcPatch(_RecordBase):
    title: str = ""
    description: str = ""
    event_ids: list[str] = Field(default_factory=list)


Record = Entity | Property | Assertion | Event | NarrativeUnit | Arc


@overload
def apply_patch(record: Entity, patch: EntityPatch) -> Entity: ...


@overload
def apply_patch(record: Property, patch: PropertyPatch) -> Property: ...


@overload
def apply_patch(record: Assertion, patch: AssertionPatch) -> Assertion: ...


@overload
def apply_patch(record: Event, patch: EventPatch) -> Event: ...


@overload
def apply_patch(record: NarrativeUnit, patch: NarrativeUnitPatch) -> NarrativeUnit: ...


@overload
def apply_patch(record: Arc, patch: ArcPatch) -> Arc: ...


def apply_patch(
    record: Entity | Property | Assertion | Event | NarrativeUnit | Arc,
    patch: EntityPatch
    | PropertyPatch
    | AssertionPatch
    | EventPatch
    | NarrativeUnitPatch
    | ArcPatch,
) -> Entity | Property | Assertion | Event | NarrativeUnit | Arc:
    """Return a copy of `record`; only fields set on `patch` are replaced."""
    updates = {name: getattr(patch, name) for name in patch.model_fields_set}
    return record.model_copy(update=updates)


# --- Story document ---------------------------------------------------------


class StoryFields(_RecordBase):
    title: str = ""
    description: str = ""
    premise: str = ""
    tone: str = ""
    themes: str = ""
    writing_style: str = ""
    unit_ids: list[str] = Field(default_factory=list)


class StoryPatch(_RecordBase):
    title: str = ""
    description: str = ""
    premise: str = ""
    tone: str = ""
    themes: str = ""
    writing_style: str = ""
    unit_ids: list[str] = Field(default_factory=list)


class StoryDocument(StoryFields):
    model_config = _FORBID

    schema_version: int = SCHEMA_VERSION
    entities: list[Entity] = Field(default_factory=list)
    properties: list[Property] = Field(default_factory=list)
    assertions: list[Assertion] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    units: list[NarrativeUnit] = Field(default_factory=list)
    arcs: list[Arc] = Field(default_factory=list)


RecordModel = (
    type[Entity]
    | type[Property]
    | type[Assertion]
    | type[Event]
    | type[NarrativeUnit]
    | type[Arc]
)

RECORD_MODELS: dict[RecordKind, RecordModel] = {
    "entity": Entity,
    "property": Property,
    "assertion": Assertion,
    "event": Event,
    "unit": NarrativeUnit,
    "arc": Arc,
}

FIELDS_MODELS: dict[
    RecordKind,
    type[EntityFields]
    | type[PropertyFields]
    | type[AssertionFields]
    | type[EventFields]
    | type[NarrativeUnitFields]
    | type[ArcFields],
] = {
    "entity": EntityFields,
    "property": PropertyFields,
    "assertion": AssertionFields,
    "event": EventFields,
    "unit": NarrativeUnitFields,
    "arc": ArcFields,
}

PATCH_MODELS: dict[
    RecordKind,
    type[EntityPatch]
    | type[PropertyPatch]
    | type[AssertionPatch]
    | type[EventPatch]
    | type[NarrativeUnitPatch]
    | type[ArcPatch],
] = {
    "entity": EntityPatch,
    "property": PropertyPatch,
    "assertion": AssertionPatch,
    "event": EventPatch,
    "unit": NarrativeUnitPatch,
    "arc": ArcPatch,
}

ID_PREFIXES: dict[RecordKind, str] = {
    "entity": "entity_",
    "property": "prop_",
    "assertion": "assertion_",
    "event": "event_",
    "unit": "unit_",
    "arc": "arc_",
}

PRIMARY_TEXT_FIELDS: dict[RecordKind, Literal["name", "statement", "title"]] = {
    "entity": "name",
    "property": "statement",
    "assertion": "statement",
    "event": "title",
    "unit": "title",
    "arc": "title",
}

DOCUMENT_LISTS: dict[RecordKind, str] = {
    "entity": "entities",
    "property": "properties",
    "assertion": "assertions",
    "event": "events",
    "unit": "units",
    "arc": "arcs",
}
