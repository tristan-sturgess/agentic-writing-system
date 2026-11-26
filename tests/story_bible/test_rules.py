"""Tests for Story Bible rule checking."""

from __future__ import annotations

import pytest

from agentic_writing_system.story_bible.records import (
    Assertion,
    AtSpan,
    Entity,
    EventPoint,
    NarrativeUnit,
    RangeSpan,
    TimestampPoint,
)
from agentic_writing_system.story_bible.rules import (
    check_document,
    named_ids,
    story_named_ids,
)
from tests.story_bible.examples import valid_document


def test_valid_document_has_no_problems() -> None:
    assert check_document(valid_document()) == []


def test_named_ids_and_story_named_ids() -> None:
    doc = valid_document()
    prop = doc.properties[0]
    ids = named_ids(prop)
    assert "entity_mara" in ids
    assert "event_arrival" in ids
    assert len(ids) == len(set(ids))
    assert story_named_ids(doc) == ["unit_act_one"]


def test_duplicate_id() -> None:
    doc = valid_document()
    dup = Entity(id="entity_mara", name="Duplicate Mara")
    doc.entities.append(dup)
    problems = check_document(doc)
    assert len(problems) == 1
    assert problems[0].code == "duplicate_id"
    assert problems[0].ids == ["entity_mara"]


def test_blank_primary_text() -> None:
    doc = valid_document()
    doc.events[0].title = "   "
    problems = check_document(doc)
    p = next(x for x in problems if x.code == "blank_primary_text")
    assert p.record_id == "event_arrival"
    assert p.field == "title"


def test_unknown_id_entity_ids() -> None:
    doc = valid_document()
    doc.events[0].entity_ids = ["entity_missing"]
    problems = check_document(doc)
    p = next(x for x in problems if x.code == "unknown_id" and x.field == "entity_ids")
    assert p.record_id == "event_arrival"
    assert p.ids == ["entity_missing"]
    assert "entity_mara" in p.legal_ids
    assert "entity_john" in p.legal_ids


def test_unknown_id_story_unit_ids() -> None:
    doc = valid_document()
    doc.unit_ids = ["unit_missing"]
    p = next(x for x in check_document(doc) if x.code == "unknown_id")
    assert p.record_id is None
    assert p.field == "unit_ids"
    assert p.ids == ["unit_missing"]
    assert "unit_act_one" in p.legal_ids


def test_delete_still_named() -> None:
    doc = valid_document()
    doc.events = [e for e in doc.events if e.id != "event_arrival"]
    problems = check_document(doc, deleted_ids=["event_arrival"])
    assert {x.code for x in problems} == {"delete_still_named"}
    p = problems[0]
    assert p.record_id == "event_arrival"
    assert p.referring == [
        "arc_mara_leaves",
        "assertion_letter_follows_arrival",
        "event_the_letter",
        "prop_mara_distrustful",
    ]
    assert "arc_mara_leaves" in p.message


def test_deleted_unit_still_in_unit_ids_names_the_story() -> None:
    doc = valid_document()
    doc.units = [u for u in doc.units if u.id == "unit_chapter_one"]
    problems = check_document(doc, deleted_ids=["unit_act_one"])
    p = next(x for x in problems if x.code == "delete_still_named")
    assert p.referring == ["story"]


def test_an_id_deleted_and_created_again_is_not_a_refused_delete() -> None:
    doc = valid_document()
    assert check_document(doc, deleted_ids=["event_arrival"]) == []


def test_assertion_needs_two() -> None:
    doc = valid_document()
    doc.assertions.append(
        Assertion(
            id="assertion_lonely",
            entity_ids=["entity_mara"],
            statement="Only one.",
        )
    )
    p = next(x for x in check_document(doc) if x.code == "assertion_needs_two")
    assert p.record_id == "assertion_lonely"


def test_unit_not_placed() -> None:
    doc = valid_document()
    doc.units.append(NarrativeUnit(id="unit_orphan", title="Orphan"))
    p = next(x for x in check_document(doc) if x.code == "unit_not_placed")
    assert p.record_id == "unit_orphan"


def test_unit_placed_twice() -> None:
    doc = valid_document()
    doc.unit_ids.append("unit_chapter_one")
    p = next(x for x in check_document(doc) if x.code == "unit_placed_twice")
    assert p.record_id == "unit_chapter_one"
    assert "story" in p.referring
    assert "unit_act_one" in p.referring


def test_unit_contains_itself() -> None:
    doc = valid_document()
    act = next(u for u in doc.units if u.id == "unit_act_one")
    act.child_ids = ["unit_act_one"]
    p = next(x for x in check_document(doc) if x.code == "unit_contains_itself")
    assert p.record_id == "unit_act_one"
    assert p.ids[0] == "unit_act_one"


@pytest.mark.parametrize(
    ("records", "record_id", "field", "values", "repeated"),
    [
        (
            "events",
            "event_arrival",
            "entity_ids",
            ["entity_mara", "entity_john", "entity_mara"],
            ["entity_mara"],
        ),
        (
            "assertions",
            "assertion_mara_john",
            "entity_ids",
            ["entity_mara", "entity_john", "entity_john"],
            ["entity_john"],
        ),
        (
            "assertions",
            "assertion_letter_follows_arrival",
            "event_ids",
            ["event_arrival", "event_the_letter", "event_arrival"],
            ["event_arrival"],
        ),
        (
            "assertions",
            "assertion_mara_leaves_is_maras",
            "arc_ids",
            ["arc_mara_leaves", "arc_mara_leaves"],
            ["arc_mara_leaves"],
        ),
        (
            "arcs",
            "arc_mara_leaves",
            "event_ids",
            ["event_arrival", "event_the_market", "event_arrival", "event_the_market"],
            ["event_arrival", "event_the_market"],
        ),
        (
            "units",
            "unit_chapter_one",
            "subject_ids",
            ["event_arrival", "event_arrival"],
            ["event_arrival"],
        ),
    ],
)
def test_an_id_repeated_in_a_list_is_refused(
    records: str, record_id: str, field: str, values: list[str], repeated: list[str]
) -> None:
    doc = valid_document()
    record = next(r for r in getattr(doc, records) if r.id == record_id)
    setattr(record, field, values)
    problems = check_document(doc)
    assert [p.code for p in problems] == ["duplicate_in_list"]
    assert problems[0].record_id == record_id
    assert problems[0].field == field
    assert problems[0].ids == repeated
    assert record_id in problems[0].message
    assert field in problems[0].message


@pytest.mark.parametrize(
    ("start", "end"),
    [
        ("1847-03-05", "1847-03-02"),
        # A date alone is the start of that day.
        ("1847-03-02T10:00", "1847-03-02"),
    ],
)
def test_a_range_that_starts_after_it_ends_is_refused(start: str, end: str) -> None:
    doc = valid_document()
    doc.events[1].when = [
        AtSpan(at=TimestampPoint(timestamp="1847-03-03")),
        RangeSpan(
            start=TimestampPoint(timestamp=start), end=TimestampPoint(timestamp=end)
        ),
    ]
    problems = check_document(doc)
    assert [p.code for p in problems] == ["range_start_after_end"]
    assert problems[0].record_id == "event_the_market"
    assert problems[0].field == "when"
    assert start in problems[0].message
    assert end in problems[0].message


def test_a_range_with_equal_bounds_is_allowed() -> None:
    doc = valid_document()
    doc.properties[0].when = [
        RangeSpan(
            start=TimestampPoint(timestamp="1847-03-02"),
            end=TimestampPoint(timestamp="1847-03-02T00:00:00"),
        )
    ]
    assert check_document(doc) == []


def test_a_range_with_an_event_bound_is_not_checked() -> None:
    doc = valid_document()
    # The market is at 1847-03-03, after this end. The docs list it as a known issue.
    doc.properties[0].when = [
        RangeSpan(
            start=EventPoint(event_id="event_the_market"),
            end=TimestampPoint(timestamp="1847-03-02"),
        )
    ]
    assert check_document(doc) == []


@pytest.mark.parametrize(
    ("records", "record_id"),
    [
        ("properties", "prop_mara_distrustful"),
        ("assertions", "assertion_mara_john"),
        ("events", "event_the_letter"),
    ],
)
def test_an_at_span_that_names_an_event_without_an_edge_is_refused(
    records: str, record_id: str
) -> None:
    doc = valid_document()
    record = next(r for r in getattr(doc, records) if r.id == record_id)
    record.when = [
        AtSpan(at=TimestampPoint(timestamp="1847-03-02")),
        AtSpan(at=EventPoint(event_id="event_the_market")),
    ]
    problems = check_document(doc)
    assert [p.code for p in problems] == ["at_needs_edge"]
    problem = problems[0]
    assert problem.record_id == record_id
    assert problem.field == "when"
    assert problem.ids == ["event_the_market"]
    assert "position 1" in problem.message
    assert "edge must be start or end" in problem.message


def test_span_cycle_self() -> None:
    doc = valid_document()
    arrival = doc.events[0]
    doc.events[0] = arrival.model_copy(
        update={"when": [AtSpan(at=EventPoint(event_id="event_arrival", edge="start"))]}
    )
    problems = check_document(doc)
    assert [p.code for p in problems] == ["span_cycle"]
    p = problems[0]
    assert p.record_id == "event_arrival"
    assert p.field == "when"
    assert p.ids == ["event_arrival", "event_arrival"]


def test_span_cycle_chain() -> None:
    doc = valid_document()
    doc.events[0] = doc.events[0].model_copy(
        update={
            "when": [AtSpan(at=EventPoint(event_id="event_the_market", edge="end"))]
        }
    )
    doc.events[1] = doc.events[1].model_copy(
        update={"when": [AtSpan(at=EventPoint(event_id="event_arrival", edge="start"))]}
    )
    problems = check_document(doc)
    assert [p.code for p in problems] == ["span_cycle", "span_cycle"]
    p = next(x for x in problems if x.record_id == "event_arrival")
    assert "event_the_market" in p.ids
