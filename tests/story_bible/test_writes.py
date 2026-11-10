"""Tests for applying writes to a story document."""

from __future__ import annotations

from pydantic import TypeAdapter

from agentic_writing_system.story_bible.records import (
    Arc,
    AtSpan,
    Event,
    EventPoint,
    StoryDocument,
)
from agentic_writing_system.story_bible.rules import Refusal
from agentic_writing_system.story_bible.writes import (
    WRITES_ADAPTER,
    Applied,
    CreateAssertion,
    CreateEntity,
    CreateEvent,
    CreateProperty,
    CreateUnit,
    DeleteWrite,
    SetStoryWrite,
    UpdateArc,
    UpdateEntity,
    UpdateEvent,
    Write,
    apply_and_check,
    apply_writes,
)
from tests.story_bible.examples import valid_document


def test_create_mints_id_and_collision_suffix() -> None:
    doc = StoryDocument()
    first = apply_writes(
        doc,
        [CreateEntity(fields={"name": "The Letter"})],
    )
    assert isinstance(first, Applied)
    assert first.created[0].id == "entity_the_letter"

    second = apply_writes(
        first.document,
        [CreateEntity(fields={"name": "The Letter"})],
    )
    assert isinstance(second, Applied)
    assert second.created[0].id == "entity_the_letter_2"


def test_entity_and_property_via_ref() -> None:
    doc = StoryDocument()
    writes: list[Write] = [
        CreateEntity(fields={"name": "Mara"}, ref="mara"),
        CreateProperty(
            fields={
                "entity_id": "@mara",
                "statement": "Mara is brave.",
            }
        ),
    ]
    result = apply_and_check(doc, writes)
    assert isinstance(result, Applied)
    assert result.document.entities[0].id == "entity_mara"
    assert result.document.properties[0].entity_id == "entity_mara"
    assert result.created[0].ref == "mara"


def test_unit_created_and_placed_via_ref() -> None:
    doc = StoryDocument()
    result = apply_and_check(
        doc,
        [
            CreateUnit(fields={"title": "Act One"}, ref="act"),
            SetStoryWrite(fields={"unit_ids": ["@act"]}),
        ],
    )
    assert isinstance(result, Applied)
    uid = result.created[0].id
    assert result.document.unit_ids == [uid]


def test_unit_not_placed_refused() -> None:
    doc = StoryDocument()
    result = apply_and_check(
        doc,
        [CreateUnit(fields={"title": "Lonely act"})],
    )
    assert isinstance(result, Refusal)
    p = result.problems[0]
    assert p.code == "unit_not_placed"


def test_ref_in_time_point() -> None:
    doc = StoryDocument()
    result = apply_and_check(
        doc,
        [
            CreateEvent(fields={"title": "Arrival"}, ref="arrival"),
            CreateEvent(
                fields={
                    "title": "Aftermath",
                    "when": [
                        {
                            "kind": "at",
                            "at": {"event_id": "@arrival"},
                        }
                    ],
                }
            ),
        ],
    )
    assert isinstance(result, Applied)
    arrival_id = result.created[0].id
    when0 = result.document.events[1].when[0]
    assert isinstance(when0, AtSpan)
    point = when0.at
    assert isinstance(point, EventPoint)
    assert point.event_id == arrival_id


def test_update_changes_only_supplied_fields() -> None:
    doc = valid_document()
    before = doc.entities[0].notes
    result = apply_writes(
        doc,
        [
            UpdateEntity(
                id="entity_mara",
                fields={"name": "Mara K."},
            )
        ],
    )
    assert isinstance(result, Applied)
    assert result.document.entities[0].name == "Mara K."
    assert result.document.entities[0].notes == before


def test_delete_entity_cascades_properties() -> None:
    doc = valid_document()
    result = apply_writes(doc, [DeleteWrite(id="entity_mara")])
    assert isinstance(result, Applied)
    assert all(p.entity_id != "entity_mara" for p in result.document.properties)
    assert "entity_mara" in result.deleted_ids
    assert "prop_mara_distrustful" in result.deleted_ids
    assert "prop_mara_cautious" in result.deleted_ids


def test_delete_event_still_named_refused() -> None:
    doc = valid_document()
    result = apply_and_check(doc, [DeleteWrite(id="event_arrival")])
    assert isinstance(result, Refusal)
    p = next(x for x in result.problems if x.code == "delete_still_named")
    assert p.record_id == "event_arrival"
    assert "arc_mara_leaves" in p.referring


def test_delete_event_after_unlink_succeeds() -> None:
    doc = StoryDocument(
        events=[
            Event(id="event_arrival", title="Arrival"),
            Event(id="event_other", title="Other"),
        ],
        arcs=[
            Arc(
                id="arc_thread",
                title="Thread",
                event_ids=["event_arrival", "event_other"],
            )
        ],
    )
    result = apply_and_check(
        doc,
        [
            UpdateArc(id="arc_thread", fields={"event_ids": ["event_other"]}),
            DeleteWrite(id="event_arrival"),
        ],
    )
    assert isinstance(result, Applied)
    assert "event_arrival" in result.deleted_ids


def test_unknown_id_on_create_refused_with_legal_ids() -> None:
    doc = StoryDocument()
    result = apply_and_check(
        doc,
        [
            CreateProperty(
                fields={
                    "entity_id": "entity_nobody",
                    "statement": "Orphan claim.",
                }
            )
        ],
    )
    assert isinstance(result, Refusal)
    p = next(x for x in result.problems if x.code == "unknown_id")
    assert p.field == "entity_id"
    assert p.legal_ids == []


def test_unknown_ref() -> None:
    doc = StoryDocument()
    result = apply_writes(
        doc,
        [CreateProperty(fields={"entity_id": "@missing", "statement": "X."})],
    )
    assert isinstance(result, Refusal)
    assert result.problems[0].code == "unknown_ref"
    assert result.problems[0].write_index == 0


def test_statement_starting_with_at_unchanged() -> None:
    doc = StoryDocument()
    text = "@alias is not a ref here."
    applied = apply_writes(
        doc,
        [
            CreateEntity(fields={"name": "A"}, ref="a"),
            CreateEntity(fields={"name": "B"}, ref="b"),
            CreateAssertion(fields={"entity_ids": ["@a", "@b"], "statement": text}),
        ],
    )
    assert isinstance(applied, Applied)
    assert applied.document.assertions[0].statement == text


def test_input_unchanged_after_refusal() -> None:
    doc = valid_document()
    snapshot = doc.model_dump()
    apply_and_check(doc, [DeleteWrite(id="event_arrival")])
    assert doc.model_dump() == snapshot


def test_writes_json_round_trip() -> None:
    payloads = [
        {"op": "create", "kind": "entity", "fields": {"name": "Mara"}, "ref": "mara"},
        {
            "op": "update",
            "kind": "entity",
            "id": "entity_mara",
            "revision": 1,
            "fields": {"notes": "Hero."},
        },
        {"op": "delete", "id": "entity_old", "revision": 2},
        {"op": "set_story", "revision": 3, "fields": {"title": "Saga"}},
    ]
    parsed = WRITES_ADAPTER.validate_python(payloads)
    round_trip = TypeAdapter(list[Write]).validate_python(
        [w.model_dump(mode="json") for w in parsed]
    )
    assert [w.model_dump(mode="json") for w in parsed] == [
        w.model_dump(mode="json") for w in round_trip
    ]


def test_cascaded_property_deletes_are_touched() -> None:
    result = apply_writes(valid_document(), [DeleteWrite(id="entity_mara")])
    assert isinstance(result, Applied)
    assert result.touched == [
        "entity_mara",
        "prop_mara_distrustful",
        "prop_mara_cautious",
    ]


def test_update_of_unknown_id_lists_ids_of_that_kind() -> None:
    result = apply_writes(
        valid_document(), [UpdateEntity(id="entity_nobody", fields={"name": "X"})]
    )
    assert isinstance(result, Refusal)
    problem = result.problems[0]
    assert problem.code == "unknown_id"
    assert problem.write_index == 0
    assert problem.ids == ["entity_nobody"]
    assert problem.legal_ids == ["entity_mara", "entity_john"]


def test_update_with_the_wrong_kind_is_refused() -> None:
    result = apply_writes(
        valid_document(), [UpdateArc(id="entity_mara", fields={"title": "X"})]
    )
    assert isinstance(result, Refusal)
    assert result.problems[0].code == "kind_mismatch"
    assert result.problems[0].record_id == "entity_mara"


def test_a_ref_used_twice_is_refused() -> None:
    result = apply_writes(
        StoryDocument(),
        [
            CreateEntity(fields={"name": "A"}, ref="x"),
            CreateEntity(fields={"name": "B"}, ref="x"),
        ],
    )
    assert isinstance(result, Refusal)
    assert result.problems[0].code == "duplicate_ref"
    assert result.problems[0].write_index == 1


def test_create_with_blank_name_is_refused() -> None:
    result = apply_writes(StoryDocument(), [CreateEntity(fields={"name": "  "})])
    assert isinstance(result, Refusal)
    assert result.problems[0].code == "blank_primary_text"
    assert result.problems[0].field == "name"


def test_update_can_name_a_record_created_in_the_same_list() -> None:
    result = apply_and_check(
        valid_document(),
        [
            CreateEvent(fields={"title": "Departure"}, ref="dep"),
            UpdateArc(
                id="arc_mara_leaves",
                fields={"event_ids": ["event_arrival", "@dep"]},
            ),
            UpdateEvent(id="@dep", fields={"description": "Mara goes."}),
        ],
    )
    assert isinstance(result, Applied)
    arc = result.document.arcs[0]
    assert arc.event_ids == ["event_arrival", "event_departure"]
    assert arc.title == "Mara leaves"
    assert result.document.events[-1].description == "Mara goes."
