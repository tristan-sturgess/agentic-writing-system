"""What is in force at a query point, one case per rule in the Story Bible doc."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from agentic_writing_system.story_bible.in_force import InForce, in_force
from agentic_writing_system.story_bible.records import (
    EventPoint,
    StoryDocument,
    TimestampPoint,
)
from agentic_writing_system.story_bible.rules import check_document

ENSEMBLE = Path(__file__).resolve().parents[2] / "samples" / "ensemble_story.json"

LETTER_DURING = "1847-03-11T00:00:00"
LETTER_END = "1847-03-12T00:00:00"
PARTING = "1847-06-01T00:00:00"


def _document(**fields: Any) -> StoryDocument:
    return StoryDocument.model_validate(fields)


def _event(event_id: str, when: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {"id": event_id, "title": event_id, "when": when or []}


def _property(
    prop_id: str,
    when: list[dict[str, Any]] | None = None,
    **extra: Any,
) -> dict[str, Any]:
    return {
        "id": prop_id,
        "entity_id": "entity_mara",
        "statement": prop_id,
        "when": when or [],
        **extra,
    }


def _at(document: StoryDocument, timestamp: str) -> InForce:
    return in_force(document, TimestampPoint(timestamp=timestamp))


def _ids(result: InForce) -> list[str]:
    return [statement.id for statement in result.statements]


def _marks(result: InForce, statement_id: str) -> list[tuple[int, str, str, list[str]]]:
    statement = next(item for item in result.statements if item.id == statement_id)
    return [
        (mark.span, mark.bound, mark.unresolved.code, mark.unresolved.event_ids)
        for mark in statement.unresolved
    ]


def test_an_empty_when_is_in_force_at_every_query_point() -> None:
    document = _document(
        events=[_event("event_untimed")],
        properties=[_property("prop_standing")],
    )
    assert _ids(_at(document, "1847-03-02")) == ["prop_standing"]
    unresolved = in_force(document, EventPoint(event_id="event_untimed", edge="start"))
    assert unresolved.query.timestamp is None
    assert unresolved.query.unresolved is not None
    assert unresolved.query.unresolved.code == "no_time"
    assert _ids(unresolved) == ["prop_standing"]


def test_a_range_includes_its_start_and_excludes_its_end() -> None:
    document = _document(
        properties=[
            _property(
                "prop_window",
                [
                    {
                        "kind": "range",
                        "start": {"timestamp": "1847-03-02"},
                        "end": {"timestamp": "1847-03-12"},
                    }
                ],
            )
        ]
    )
    assert _ids(_at(document, "1847-03-02")) == ["prop_window"]
    assert _ids(_at(document, "1847-03-11")) == ["prop_window"]
    assert _ids(_at(document, "1847-03-12")) == []
    assert _ids(_at(document, "1847-03-01")) == []


def test_an_absent_end_still_applies_after_the_start() -> None:
    document = _document(
        properties=[
            _property(
                "prop_open",
                [{"kind": "range", "start": {"timestamp": "1847-03-02"}}],
            )
        ]
    )
    assert _ids(_at(document, "1847-03-02")) == ["prop_open"]
    assert _ids(_at(document, "1900-01-01")) == ["prop_open"]
    assert _ids(_at(document, "1847-03-01")) == []


def test_an_absent_start_applies_until_the_end() -> None:
    document = _document(
        properties=[
            _property(
                "prop_until",
                [{"kind": "range", "end": {"timestamp": "1847-06-01"}}],
            )
        ]
    )
    assert _ids(_at(document, "0001-01-01")) == ["prop_until"]
    assert _ids(_at(document, "1847-05-31")) == ["prop_until"]
    assert _ids(_at(document, "1847-06-01")) == []


def test_a_range_with_neither_bound_covers_every_query_point() -> None:
    """Both bounds absent is the coverage rule with nothing to compare."""
    document = _document(
        events=[_event("event_untimed")],
        properties=[_property("prop_open", [{"kind": "range"}])],
    )
    assert _ids(_at(document, "1847-03-02")) == ["prop_open"]
    unresolved = in_force(document, EventPoint(event_id="event_untimed", edge="end"))
    assert _ids(unresolved) == ["prop_open"]
    assert unresolved.statements[0].unresolved == []


def test_separate_ranges_do_not_fill_the_gap_between_them() -> None:
    document = _document(
        properties=[
            _property(
                "prop_gapped",
                [
                    {
                        "kind": "range",
                        "start": {"timestamp": "1846-01-01"},
                        "end": {"timestamp": "1847-01-01"},
                    },
                    {
                        "kind": "range",
                        "start": {"timestamp": "1847-03-04"},
                    },
                ],
            )
        ]
    )
    assert _ids(_at(document, "1846-06-01")) == ["prop_gapped"]
    assert _ids(_at(document, "1847-02-01")) == []
    assert _ids(_at(document, "1847-03-04")) == ["prop_gapped"]


def test_an_at_span_does_not_put_a_statement_in_force() -> None:
    document = _document(
        properties=[
            _property(
                "prop_seen",
                [{"kind": "at", "at": {"timestamp": "1847-03-04T09:00"}}],
            )
        ]
    )
    assert _ids(_at(document, "1847-03-04T09:00")) == []


def test_an_at_outside_a_range_does_not_extend_the_range() -> None:
    document = _document(
        properties=[
            _property(
                "prop_mixed",
                [
                    {
                        "kind": "range",
                        "start": {"timestamp": "1847-03-02"},
                        "end": {"timestamp": "1847-03-04"},
                    },
                    {"kind": "at", "at": {"timestamp": "1847-06-01"}},
                ],
            )
        ]
    )
    held = _at(document, "1847-03-03")
    assert _ids(held) == ["prop_mixed"]
    assert held.statements[0].unresolved == []
    assert _ids(_at(document, "1847-06-01")) == []


def test_a_point_that_names_an_event_compares_as_the_timestamp_it_resolves_to() -> None:
    """A range start with no edge is the Event's end. The query names an end."""
    document = _document(
        events=[
            _event(
                "event_period",
                [
                    {
                        "kind": "range",
                        "start": {"timestamp": "1847-03-02T08:00"},
                        "end": {"timestamp": "1847-03-02T18:00"},
                    }
                ],
            )
        ],
        properties=[
            _property(
                "prop_after",
                [{"kind": "range", "start": {"event_id": "event_period"}}],
            )
        ],
    )
    assert _ids(_at(document, "1847-03-02T12:00")) == []
    assert _ids(_at(document, "1847-03-02T18:00")) == ["prop_after"]
    by_edge = in_force(document, EventPoint(event_id="event_period", edge="end"))
    assert by_edge.query.timestamp == "1847-03-02T18:00:00"
    assert by_edge.query.edge == "end"
    assert _ids(by_edge) == ["prop_after"]


def test_an_unresolved_comparison_includes_the_statement_and_marks_it() -> None:
    document = _document(
        events=[_event("event_untimed")],
        properties=[
            _property(
                "prop_heard",
                [{"kind": "range", "start": {"event_id": "event_untimed"}}],
            )
        ],
    )
    result = _at(document, "1847-03-02")
    assert _ids(result) == ["prop_heard"]
    assert _marks(result, "prop_heard") == [(0, "start", "no_time", ["event_untimed"])]


def test_a_resolved_bound_outside_the_range_wins_over_an_unresolved_one() -> None:
    """The point is before the start, so the unresolved end is not marked."""
    document = _document(
        events=[_event("event_untimed")],
        properties=[
            _property(
                "prop_later",
                [
                    {
                        "kind": "range",
                        "start": {"timestamp": "1847-06-01"},
                        "end": {"event_id": "event_untimed"},
                    }
                ],
            )
        ],
    )
    assert _ids(_at(document, "1847-03-01")) == []


def test_a_covering_range_keeps_an_unresolved_range_marked() -> None:
    document = _document(
        events=[_event("event_untimed")],
        properties=[
            _property(
                "prop_both",
                [
                    {"kind": "range", "start": {"timestamp": "1847-01-01"}},
                    {"kind": "range", "end": {"event_id": "event_untimed"}},
                ],
            )
        ],
    )
    result = _at(document, "1847-03-02")
    assert _ids(result) == ["prop_both"]
    assert _marks(result, "prop_both") == [(1, "end", "no_time", ["event_untimed"])]


def test_a_range_that_ends_before_it_starts_covers_no_point() -> None:
    document = _document(
        properties=[
            _property(
                "prop_backwards",
                [
                    {
                        "kind": "range",
                        "start": {"timestamp": "1847-06-01"},
                        "end": {"timestamp": "1847-03-02"},
                    }
                ],
            )
        ]
    )
    assert _ids(_at(document, "1847-03-02")) == []
    assert _ids(_at(document, "1847-06-01")) == []
    assert _ids(_at(document, "1847-04-01")) == []


def test_supersedes_does_not_close_a_range_the_spans_leave_open() -> None:
    document = _document(
        properties=[
            _property(
                "prop_old",
                [{"kind": "range", "start": {"timestamp": "1847-03-04"}}],
            ),
            _property(
                "prop_new",
                [{"kind": "range", "start": {"timestamp": "1847-03-12"}}],
                supersedes="prop_old",
            ),
        ]
    )
    assert _ids(_at(document, "1847-03-12")) == ["prop_old", "prop_new"]


def test_two_contradictory_statements_are_both_included() -> None:
    document = _document(
        properties=[
            _property("prop_trusts", [{"kind": "range"}]),
            _property("prop_doubts", [{"kind": "range"}]),
        ]
    )
    assert _ids(_at(document, "1847-03-02")) == ["prop_trusts", "prop_doubts"]


def test_an_unresolved_query_lists_only_statements_that_need_no_comparison() -> None:
    document = _document(
        events=[_event("event_untimed")],
        properties=[
            _property("prop_standing"),
            _property("prop_boundless", [{"kind": "range"}]),
            _property(
                "prop_dated",
                [{"kind": "range", "start": {"timestamp": "1847-03-02"}}],
            ),
            _property(
                "prop_heard",
                [{"kind": "range", "start": {"event_id": "event_untimed"}}],
            ),
        ],
    )
    result = in_force(document, EventPoint(event_id="event_untimed", edge="start"))
    assert result.query.timestamp is None
    assert _ids(result) == ["prop_standing", "prop_boundless"]


def test_statements_are_properties_in_order_then_assertions_in_order() -> None:
    document = _document(
        properties=[_property("prop_first"), _property("prop_second")],
        assertions=[
            {
                "id": "assertion_one",
                "entity_ids": ["entity_mara", "entity_john"],
                "statement": "One",
            },
            {
                "id": "assertion_two",
                "entity_ids": ["entity_mara", "entity_john"],
                "statement": "Two",
                "when": [{"kind": "at", "at": {"timestamp": "1847-03-02"}}],
            },
        ],
    )
    result = _at(document, "1847-03-02")
    assert [(item.kind, item.id) for item in result.statements] == [
        ("property", "prop_first"),
        ("property", "prop_second"),
        ("assertion", "assertion_one"),
    ]


def test_an_event_query_without_an_edge_is_an_error() -> None:
    with pytest.raises(ValueError, match="edge"):
        in_force(_document(), EventPoint(event_id="event_arrival"))


def test_ensemble_sample_readings() -> None:
    """The sample the entities view is checked against reads as its doc says."""
    document = StoryDocument.model_validate(
        cast(dict[str, Any], json.loads(ENSEMBLE.read_text(encoding="utf-8")))
    )
    assert check_document(document) == []

    during = _at(document, "1847-03-11")
    assert "prop_mara_is_generally_distrustful_of_strangers" in _ids(during)
    assert "prop_mara_is_cautiously_willing_to_trust_strangers" not in _ids(during)

    ended = _at(document, "1847-03-12")
    ended_ids = _ids(ended)
    assert "prop_mara_is_generally_distrustful_of_strangers" not in ended_ids
    assert "prop_mara_is_cautiously_willing_to_trust_strangers" in ended_ids
    assert "prop_mara_keeps_the_letter_folded_in_her_coat" not in ended_ids
    assert "prop_mara_answers_to_no_one_in_the_city" in ended_ids
    assert "prop_mara_works_a_stall_at_the_grey_market" in ended_ids
    assert "prop_john_trusts_mara" in ended_ids
    assert "prop_john_doubts_mara" in ended_ids
    assert "assertion_mara_distrusts_john" not in ended_ids
    assert "assertion_mara_and_john_share_the_market" in ended_ids
    assert _marks(ended, "prop_mara_heard_johns_name_before_she_met_him") == [
        (0, "start", "no_time", ["event_the_rumour"])
    ]
    assert (
        _ids(_at(document, "1847-02-01")).count(
            "prop_mara_works_a_stall_at_the_grey_market"
        )
        == 0
    )

    parting = _at(document, "1847-06-01")
    assert "prop_john_sells_wool_at_the_grey_market" not in _ids(parting)
    assert "prop_john_has_left_the_city" in _ids(parting)
    assert "prop_john_trusts_mara" in _ids(parting)
    assert "prop_john_doubts_mara" in _ids(parting)
    assert ended.query.timestamp == LETTER_END
    assert parting.query.timestamp == PARTING
    assert _at(document, "1847-03-11").query.timestamp == LETTER_DURING
