"""Apply an ordered list of writes to a story document."""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from agentic_writing_system.story_bible.ids import BlankPrimaryTextError, mint_id
from agentic_writing_system.story_bible.records import (
    DOCUMENT_LISTS,
    PRIMARY_TEXT_FIELDS,
    RECORD_MODELS,
    ArcFields,
    ArcPatch,
    AssertionFields,
    AssertionPatch,
    EntityFields,
    EntityPatch,
    EventFields,
    EventPatch,
    NarrativeUnitFields,
    NarrativeUnitPatch,
    PropertyFields,
    PropertyPatch,
    Record,
    RecordKind,
    StoryDocument,
    StoryPatch,
)
from agentic_writing_system.story_bible.rules import Problem, Refusal, check_document

_FORBID = ConfigDict(extra="forbid")
_REF_PATTERN = r"^[A-Za-z0-9_-]+$"


class CreateEntity(BaseModel):
    model_config = _FORBID

    op: Literal["create"] = "create"
    kind: Literal["entity"] = "entity"
    fields: EntityFields
    ref: str | None = Field(default=None, pattern=_REF_PATTERN)


class CreateProperty(BaseModel):
    model_config = _FORBID

    op: Literal["create"] = "create"
    kind: Literal["property"] = "property"
    fields: PropertyFields
    ref: str | None = Field(default=None, pattern=_REF_PATTERN)


class CreateAssertion(BaseModel):
    model_config = _FORBID

    op: Literal["create"] = "create"
    kind: Literal["assertion"] = "assertion"
    fields: AssertionFields
    ref: str | None = Field(default=None, pattern=_REF_PATTERN)


class CreateEvent(BaseModel):
    model_config = _FORBID

    op: Literal["create"] = "create"
    kind: Literal["event"] = "event"
    fields: EventFields
    ref: str | None = Field(default=None, pattern=_REF_PATTERN)


class CreateUnit(BaseModel):
    model_config = _FORBID

    op: Literal["create"] = "create"
    kind: Literal["unit"] = "unit"
    fields: NarrativeUnitFields
    ref: str | None = Field(default=None, pattern=_REF_PATTERN)


class CreateArc(BaseModel):
    model_config = _FORBID

    op: Literal["create"] = "create"
    kind: Literal["arc"] = "arc"
    fields: ArcFields
    ref: str | None = Field(default=None, pattern=_REF_PATTERN)


type CreateWrite = Annotated[
    CreateEntity
    | CreateProperty
    | CreateAssertion
    | CreateEvent
    | CreateUnit
    | CreateArc,
    Field(discriminator="kind"),
]


class UpdateEntity(BaseModel):
    model_config = _FORBID

    op: Literal["update"] = "update"
    kind: Literal["entity"] = "entity"
    id: str
    revision: int | None = None
    fields: EntityPatch


class UpdateProperty(BaseModel):
    model_config = _FORBID

    op: Literal["update"] = "update"
    kind: Literal["property"] = "property"
    id: str
    revision: int | None = None
    fields: PropertyPatch


class UpdateAssertion(BaseModel):
    model_config = _FORBID

    op: Literal["update"] = "update"
    kind: Literal["assertion"] = "assertion"
    id: str
    revision: int | None = None
    fields: AssertionPatch


class UpdateEvent(BaseModel):
    model_config = _FORBID

    op: Literal["update"] = "update"
    kind: Literal["event"] = "event"
    id: str
    revision: int | None = None
    fields: EventPatch


class UpdateUnit(BaseModel):
    model_config = _FORBID

    op: Literal["update"] = "update"
    kind: Literal["unit"] = "unit"
    id: str
    revision: int | None = None
    fields: NarrativeUnitPatch


class UpdateArc(BaseModel):
    model_config = _FORBID

    op: Literal["update"] = "update"
    kind: Literal["arc"] = "arc"
    id: str
    revision: int | None = None
    fields: ArcPatch


type UpdateWrite = Annotated[
    UpdateEntity
    | UpdateProperty
    | UpdateAssertion
    | UpdateEvent
    | UpdateUnit
    | UpdateArc,
    Field(discriminator="kind"),
]


class DeleteWrite(BaseModel):
    model_config = _FORBID

    op: Literal["delete"] = "delete"
    id: str
    revision: int | None = None


class SetStoryWrite(BaseModel):
    model_config = _FORBID

    op: Literal["set_story"] = "set_story"
    revision: int | None = None
    fields: StoryPatch


type Write = Annotated[
    CreateWrite | UpdateWrite | DeleteWrite | SetStoryWrite,
    Field(discriminator="op"),
]

WRITE_ADAPTER: TypeAdapter[Write] = TypeAdapter(Write)
WRITES_ADAPTER: TypeAdapter[list[Write]] = TypeAdapter(list[Write])


class CreatedRecord(BaseModel):
    model_config = _FORBID

    kind: RecordKind
    id: str
    ref: str | None


class Applied(BaseModel):
    """The result of applying writes to a copy of a document.

    `touched` has each record id a write created, changed, or deleted, cascades
    included, in order of first touch. `None` is the story itself.
    """

    model_config = _FORBID

    document: StoryDocument
    created: list[CreatedRecord]
    touched: list[str | None]
    deleted_ids: list[str]


# --- Refs -------------------------------------------------------------------

# The fields that hold an id, by name. A text field never has one of these
# names, so text that starts with "@" is left alone.
_ID_FIELDS = frozenset({"entity_id", "caused_by"})
_ID_LIST_FIELDS = frozenset(
    {"entity_ids", "event_ids", "arc_ids", "child_ids", "subject_ids", "unit_ids"}
)
_TIME_POINT_KEYS = ("at", "start", "end")


class _UnknownRefError(Exception):
    def __init__(self, label: str) -> None:
        super().__init__(label)
        self.label = label


def _resolve_refs(write: Write, refs: Mapping[str, str]) -> Write:
    """The write with each `@label` in an id position replaced by its minted id."""

    def resolve(value: str) -> str:
        if not value.startswith("@"):
            return value
        label = value[1:]
        if label not in refs:
            raise _UnknownRefError(label)
        return refs[label]

    data = write.model_dump()
    if "id" in data:
        data["id"] = resolve(data["id"])
    if write.op != "delete":
        fields: dict[str, Any] = data["fields"]
        if write.op != "create":
            # A patch: keep only the fields the caller supplied.
            fields = {name: fields[name] for name in write.fields.model_fields_set}
        for name, value in fields.items():
            if name in _ID_FIELDS and isinstance(value, str):
                fields[name] = resolve(value)
            elif name in _ID_LIST_FIELDS:
                fields[name] = [resolve(item) for item in value]
            elif name == "when":
                for span in value:
                    for key in _TIME_POINT_KEYS:
                        point = span.get(key)
                        if point and "event_id" in point:
                            point["event_id"] = resolve(point["event_id"])
        data["fields"] = fields
    return WRITE_ADAPTER.validate_python(data)


# --- Apply ------------------------------------------------------------------


def _records_of(document: StoryDocument, kind: RecordKind) -> list[Any]:
    records: list[Any] = getattr(document, DOCUMENT_LISTS[kind])
    return records


def _all_records(document: StoryDocument) -> Iterator[tuple[RecordKind, int, Record]]:
    for kind in DOCUMENT_LISTS:
        for position, record in enumerate(_records_of(document, kind)):
            yield kind, position, record


def _find(document: StoryDocument, record_id: str) -> tuple[RecordKind, int] | None:
    for kind, position, record in _all_records(document):
        if record.id == record_id:
            return kind, position
    return None


def _ids(document: StoryDocument, kind: RecordKind | None = None) -> list[str]:
    return [
        record.id
        for record_kind, _, record in _all_records(document)
        if kind is None or record_kind == kind
    ]


def _refuse(index: int, problem: Problem) -> Refusal:
    problem = problem.model_copy(update={"write_index": index})
    return Refusal(message=problem.message, problems=[problem])


def apply_writes(document: StoryDocument, writes: Sequence[Write]) -> Applied | Refusal:
    """Apply the writes, in order, to a copy of the document.

    A failure that can only be found while applying is a `Refusal` with one
    problem carrying the position of the write. The rules that judge the
    resulting document are in `check_document`.
    """
    working = document.model_copy(deep=True)
    refs: dict[str, str] = {}
    created: list[CreatedRecord] = []
    touched: list[str | None] = []
    deleted_ids: list[str] = []

    def touch(row: str | None) -> None:
        if row not in touched:
            touched.append(row)

    for index, unresolved in enumerate(writes):
        try:
            write = _resolve_refs(unresolved, refs)
        except _UnknownRefError as exc:
            return _refuse(
                index,
                Problem(
                    code="unknown_ref",
                    message=(
                        f"Write {index} names @{exc.label}, and no earlier create "
                        "in this commit has that ref."
                    ),
                    ids=[exc.label],
                ),
            )

        if write.op == "create":
            if write.ref is not None and write.ref in refs:
                return _refuse(
                    index,
                    Problem(
                        code="duplicate_ref",
                        message=(
                            f"Write {index} uses the ref {write.ref}, which an "
                            "earlier create in this commit already has."
                        ),
                        ids=[write.ref],
                    ),
                )
            primary_field = PRIMARY_TEXT_FIELDS[write.kind]
            try:
                record_id = mint_id(
                    write.kind, getattr(write.fields, primary_field), _ids(working)
                )
            except BlankPrimaryTextError:
                return _refuse(
                    index,
                    Problem(
                        code="blank_primary_text",
                        message=(
                            f"Write {index} creates a record with a blank "
                            f"{primary_field}."
                        ),
                        field=primary_field,
                    ),
                )
            record = RECORD_MODELS[write.kind].model_validate(
                {**write.fields.model_dump(), "id": record_id}
            )
            _records_of(working, write.kind).append(record)
            created.append(CreatedRecord(kind=write.kind, id=record_id, ref=write.ref))
            if write.ref is not None:
                refs[write.ref] = record_id
            touch(record_id)

        elif write.op == "update":
            found = _find(working, write.id)
            if found is None:
                return _refuse(
                    index,
                    Problem(
                        code="unknown_id",
                        message=(
                            f"Write {index} updates {write.id}, which does not exist."
                        ),
                        field="id",
                        ids=[write.id],
                        legal_ids=_ids(working, write.kind),
                    ),
                )
            kind, position = found
            if kind != write.kind:
                return _refuse(
                    index,
                    Problem(
                        code="kind_mismatch",
                        message=(
                            f"Write {index} updates {write.id} as kind "
                            f"{write.kind}, and it is kind {kind}."
                        ),
                        record_id=write.id,
                        field="kind",
                    ),
                )
            records = _records_of(working, kind)
            patch = write.fields
            records[position] = records[position].model_copy(
                update={name: getattr(patch, name) for name in patch.model_fields_set}
            )
            touch(write.id)

        elif write.op == "delete":
            found = _find(working, write.id)
            if found is None:
                return _refuse(
                    index,
                    Problem(
                        code="unknown_id",
                        message=(
                            f"Write {index} deletes {write.id}, which does not exist."
                        ),
                        field="id",
                        ids=[write.id],
                        legal_ids=_ids(working),
                    ),
                )
            kind, position = found
            del _records_of(working, kind)[position]
            deleted_ids.append(write.id)
            touch(write.id)
            if kind == "entity":
                # An Entity owns its Properties.
                owned = [p.id for p in working.properties if p.entity_id == write.id]
                working.properties = [
                    p for p in working.properties if p.entity_id != write.id
                ]
                for property_id in owned:
                    deleted_ids.append(property_id)
                    touch(property_id)

        else:
            story_patch = write.fields
            for name in story_patch.model_fields_set:
                setattr(working, name, getattr(story_patch, name))
            if story_patch.model_fields_set:
                touch(None)

    return Applied(
        document=working,
        created=created,
        touched=touched,
        deleted_ids=deleted_ids,
    )


def refusal_message(problems: Sequence[Problem]) -> str:
    """A one-line summary of a list of problems."""
    if len(problems) == 1:
        return problems[0].message
    return f"{len(problems)} problems. The first: {problems[0].message}"


def apply_and_check(
    document: StoryDocument, writes: Sequence[Write]
) -> Applied | Refusal:
    """Apply the writes, then check the resulting document against the rules."""
    applied = apply_writes(document, writes)
    if isinstance(applied, Refusal):
        return applied
    problems = check_document(applied.document, applied.deleted_ids)
    if not problems:
        return applied
    return Refusal(message=refusal_message(problems), problems=problems)
