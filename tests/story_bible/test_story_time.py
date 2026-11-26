"""Resolving a time point, one case per rule in the Story Bible doc."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from agentic_writing_system.story_bible.records import (
    EventPoint,
    StoryDocument,
    TimestampPoint,
)
from agentic_writing_system.story_bible.rules import check_document
from agentic_writing_system.story_bible.story_time import (
    EventTime,
    EventTimeAt,
    EventTimePoint,
    EventTimeRange,
    PointPlace,
    PointReading,
    UnresolvedTime,
    event_times,
    resolve_point,
    statement_times,
)

TIMELINE_SAMPLE = (
    Path(__file__).resolve().parents[2] / "samples" / "timeline_story.json"
)

_PERIOD_START = "1847-03-02T08:00:00"
_PERIOD_END = "1847-03-02T18:00:00"


def _document(*events: dict[str, Any]) -> StoryDocument:
    return StoryDocument.model_validate({"events": list(events)})


def _period() -> StoryDocument:
    """One Event lasting from 08:00 to 18:00, so its two ends differ."""
    return _document(
        {
            "id": "event_period",
            "title": "Period",
            "when": [
                {
                    "kind": "range",
                    "start": {"timestamp": "1847-03-02T08:00"},
                    "end": {"timestamp": "1847-03-02T18:00"},
                }
            ],
        }
    )


def _reading(
    document: StoryDocument,
    point: TimestampPoint | EventPoint,
    place: PointPlace,
) -> PointReading:
    return resolve_point(document, point, place)


def test_a_stored_timestamp_resolves_to_the_comparable_form() -> None:
    """A date is the start of that day, and the value is YYYY-MM-DDTHH:MM:SS."""
    document = _document({"id": "event_a", "title": "A"})
    assert _reading(document, TimestampPoint(timestamp="0099-01-02"), "start") == (
        PointReading(edge=None, timestamp="0099-01-02T00:00:00", unresolved=None)
    )
    assert _reading(document, TimestampPoint(timestamp="0099-01-02T03:04"), "end") == (
        PointReading(edge=None, timestamp="0099-01-02T03:04:00", unresolved=None)
    )
    assert _reading(
        document, TimestampPoint(timestamp="0099-01-02T03:04:05"), "at"
    ) == PointReading(edge=None, timestamp="0099-01-02T03:04:05", unresolved=None)


def test_a_range_start_with_no_edge_means_the_events_end() -> None:
    reading = _reading(_period(), EventPoint(event_id="event_period"), "start")
    assert reading == PointReading(edge="end", timestamp=_PERIOD_END, unresolved=None)


def test_a_range_end_with_no_edge_means_the_events_start() -> None:
    reading = _reading(_period(), EventPoint(event_id="event_period"), "end")
    assert reading == PointReading(
        edge="start", timestamp=_PERIOD_START, unresolved=None
    )


def test_an_explicit_start_is_the_events_start() -> None:
    """The stored edge wins over the end a range's start would mean."""
    point = EventPoint(event_id="event_period", edge="start")
    reading = _reading(_period(), point, "start")
    assert reading == PointReading(
        edge="start", timestamp=_PERIOD_START, unresolved=None
    )


def test_an_explicit_end_is_the_events_end() -> None:
    """The stored edge wins over the start a range's end would mean."""
    point = EventPoint(event_id="event_period", edge="end")
    reading = _reading(_period(), point, "end")
    assert reading == PointReading(edge="end", timestamp=_PERIOD_END, unresolved=None)


def test_a_chain_through_three_events_resolves_to_the_timestamp() -> None:
    """C names B, B names A's start, and A is a period, so the chain yields 08:00."""
    document = _document(
        {
            "id": "event_a",
            "title": "A",
            "when": [
                {
                    "kind": "range",
                    "start": {"timestamp": "1847-03-02T08:00"},
                    "end": {"timestamp": "1847-03-02T18:00"},
                }
            ],
        },
        {
            "id": "event_b",
            "title": "B",
            "when": [
                {"kind": "at", "at": {"event_id": "event_a", "edge": "start"}},
            ],
        },
        {
            "id": "event_c",
            "title": "C",
            "when": [
                {"kind": "at", "at": {"event_id": "event_b", "edge": "end"}},
            ],
        },
    )
    reading = _reading(document, EventPoint(event_id="event_c", edge="end"), "at")
    assert reading == PointReading(edge="end", timestamp=_PERIOD_START, unresolved=None)


def test_an_event_with_no_time_is_unresolved() -> None:
    document = _document({"id": "event_a", "title": "A", "when": []})
    reading = _reading(document, EventPoint(event_id="event_a", edge="start"), "at")
    assert reading == PointReading(
        edge="start",
        timestamp=None,
        unresolved=UnresolvedTime(code="no_time", event_ids=["event_a"]),
    )


def test_several_spans_stops_the_chain() -> None:
    """B has one span, so the chain passes through B and stops at A."""
    document = _document(
        {
            "id": "event_a",
            "title": "A",
            "when": [
                {"kind": "at", "at": {"timestamp": "1847-03-02"}},
                {"kind": "at", "at": {"timestamp": "1847-03-03"}},
            ],
        },
        {
            "id": "event_b",
            "title": "B",
            "when": [
                {"kind": "at", "at": {"event_id": "event_a", "edge": "start"}},
            ],
        },
    )
    reading = _reading(document, EventPoint(event_id="event_b", edge="end"), "at")
    assert reading == PointReading(
        edge="end",
        timestamp=None,
        unresolved=UnresolvedTime(
            code="several_spans", event_ids=["event_b", "event_a"]
        ),
    )


def test_an_absent_bound_is_unresolved() -> None:
    document = _document(
        {
            "id": "event_a",
            "title": "A",
            "when": [{"kind": "range", "end": {"timestamp": "1847-03-02"}}],
        }
    )
    reading = _reading(document, EventPoint(event_id="event_a", edge="start"), "at")
    assert reading == PointReading(
        edge="start",
        timestamp=None,
        unresolved=UnresolvedTime(code="bound_absent", event_ids=["event_a"]),
    )


def test_a_range_that_ends_before_it_starts_is_marked() -> None:
    document = _document(
        {
            "id": "event_early",
            "title": "Early",
            "when": [{"kind": "at", "at": {"timestamp": "1847-03-02T00:00:00"}}],
        },
        {
            "id": "event_late",
            "title": "Late",
            "when": [{"kind": "at", "at": {"timestamp": "1847-03-04"}}],
        },
        {"id": "event_blank", "title": "Blank", "when": []},
        {
            "id": "event_inverted",
            "title": "Inverted",
            "when": [
                {
                    "kind": "range",
                    "start": {"event_id": "event_late", "edge": "start"},
                    "end": {"event_id": "event_early", "edge": "end"},
                }
            ],
        },
        {
            "id": "event_equal",
            "title": "Equal",
            "when": [
                {
                    "kind": "range",
                    # The same moment, written once with a time and once as a date.
                    "start": {"timestamp": "1847-03-02T00:00"},
                    "end": {"timestamp": "1847-03-02"},
                }
            ],
        },
        {
            "id": "event_open",
            "title": "Open",
            "when": [
                {"kind": "range", "start": {"event_id": "event_late", "edge": "end"}}
            ],
        },
        {
            "id": "event_unresolved",
            "title": "Unresolved",
            "when": [
                {
                    "kind": "range",
                    "start": {"timestamp": "1847-03-09"},
                    "end": {"event_id": "event_blank", "edge": "end"},
                }
            ],
        },
    )
    by_id = {event.id: event for event in event_times(document).events}

    inverted = by_id["event_inverted"].spans[0]
    assert isinstance(inverted, EventTimeRange)
    assert inverted.ends_before_start is True
    assert inverted.start == EventTimePoint(
        point=EventPoint(event_id="event_late", edge="start"),
        edge="start",
        timestamp="1847-03-04T00:00:00",
        unresolved=None,
    )
    assert inverted.end is not None
    assert inverted.end.timestamp == "1847-03-02T00:00:00"

    equal = by_id["event_equal"].spans[0]
    assert isinstance(equal, EventTimeRange)
    assert equal.ends_before_start is False
    assert equal.start is not None and equal.end is not None
    assert equal.start.timestamp == equal.end.timestamp == "1847-03-02T00:00:00"

    open_span = by_id["event_open"].spans[0]
    assert isinstance(open_span, EventTimeRange)
    assert open_span.end is None
    assert open_span.ends_before_start is False

    unresolved = by_id["event_unresolved"].spans[0]
    assert isinstance(unresolved, EventTimeRange)
    assert unresolved.end is not None and unresolved.end.timestamp is None
    assert unresolved.ends_before_start is False


def test_event_times_follows_the_stored_events_and_spans() -> None:
    document = _document(
        {"id": "event_none", "title": "None", "when": []},
        {
            "id": "event_moment",
            "title": "Moment",
            "when": [{"kind": "at", "at": {"timestamp": "1847-03-02T04:05"}}],
        },
        {
            "id": "event_open",
            "title": "Open",
            "when": [{"kind": "range", "end": {"event_id": "event_moment"}}],
        },
    )
    times = event_times(document)
    assert [event.id for event in times.events] == [
        "event_none",
        "event_moment",
        "event_open",
    ]
    assert times.events[0].spans == []

    moment = times.events[1].spans[0]
    assert isinstance(moment, EventTimeAt)
    assert moment.at == EventTimePoint(
        point=TimestampPoint(timestamp="1847-03-02T04:05"),
        edge=None,
        timestamp="1847-03-02T04:05:00",
        unresolved=None,
    )

    open_span = times.events[2].spans[0]
    assert isinstance(open_span, EventTimeRange)
    assert open_span.start is None
    assert open_span.end == EventTimePoint(
        point=EventPoint(event_id="event_moment", edge=None),
        edge="start",
        timestamp="1847-03-02T04:05:00",
        unresolved=None,
    )


def _span(times: dict[str, EventTime], event_id: str) -> EventTimeAt | EventTimeRange:
    return times[event_id].spans[0]


def test_the_timeline_sample_covers_every_span_shape() -> None:
    """samples/timeline_story.json holds every shape docs/ui/timeline.md lists."""
    raw = cast(dict[str, Any], json.loads(TIMELINE_SAMPLE.read_text(encoding="utf-8")))
    document = StoryDocument.model_validate(raw)
    assert check_document(document) == []
    times = {event.id: event for event in event_times(document).events}
    assert [event.id for event in document.events] == list(times)

    def moment(event_id: str) -> EventTimePoint:
        span = _span(times, event_id)
        assert isinstance(span, EventTimeAt)
        return span.at

    def period(event_id: str) -> EventTimeRange:
        span = _span(times, event_id)
        assert isinstance(span, EventTimeRange)
        return span

    assert moment("event_the_oath").timestamp == "1000-01-01T00:00:00"
    assert moment("event_the_oath").edge is None
    assert moment("event_the_toast").timestamp == "1012-11-03T21:00:00"
    assert moment("event_the_bell").timestamp == "1012-11-03T21:00:00"

    decree = moment("event_the_first_decree")
    assert decree.timestamp == "1000-01-01T00:00:00"
    assert decree.edge == "start"
    announcement = moment("event_the_announcement")
    assert announcement.timestamp == "1012-11-03T18:00:00"
    assert announcement.edge == "start"

    assert moment("event_seated").timestamp == "1012-11-03T18:00:00"
    assert moment("event_seated").edge == "start"
    assert moment("event_last_cup").timestamp == "1012-11-03T23:00:00"
    assert moment("event_last_cup").edge == "end"

    reign = period("event_the_reign")
    assert reign.start is not None and reign.end is not None
    assert reign.start.edge == "end"
    assert reign.start.timestamp == "1000-01-01T00:00:00"
    assert reign.end.timestamp == "1010-06-01T00:00:00"
    assert reign.ends_before_start is False

    ride = period("event_the_ride")
    assert ride.start is not None and ride.end is not None
    assert ride.start.timestamp == "1012-11-03T18:30:00"
    assert ride.end.edge == "start"
    assert ride.end.timestamp == "1012-11-03T21:00:00"

    before = period("event_before_the_feast")
    assert before.end is not None
    assert before.end.edge == "start"
    assert before.end.timestamp == "1012-11-03T18:00:00"
    after = period("event_after_the_feast")
    assert after.start is not None
    assert after.start.edge == "end"
    assert after.start.timestamp == "1012-11-03T23:00:00"

    feast = period("event_the_feast")
    dance = period("event_the_dance")
    argument = period("event_the_argument")
    assert feast.start is not None and feast.end is not None
    assert dance.start is not None and dance.end is not None
    assert argument.start is not None and argument.end is not None
    feast_start, feast_end = feast.start.timestamp, feast.end.timestamp
    dance_start, dance_end = dance.start.timestamp, dance.end.timestamp
    argument_start, argument_end = argument.start.timestamp, argument.end.timestamp
    assert feast_start is not None and feast_end is not None
    assert dance_start is not None and dance_end is not None
    assert argument_start is not None and argument_end is not None
    assert feast_start < dance_start < argument_start
    assert argument_end < feast_end
    assert dance_start > feast_start
    assert dance_end < feast_end
    assert dance_start < argument_end
    assert argument_start < dance_end

    knocks = times["event_the_three_knocks"].spans
    assert [span.at.timestamp for span in knocks if isinstance(span, EventTimeAt)] == [
        "1012-11-03T22:10:00",
        "1012-11-03T22:12:00",
        "1012-11-03T22:15:00",
    ]

    grudge = period("event_the_old_grudge")
    assert grudge.start is None
    assert grudge.end is not None
    assert grudge.end.timestamp == "0999-06-01T00:00:00"
    snow = period("event_the_snow")
    assert snow.end is None
    assert snow.start is not None
    assert snow.start.timestamp == "1012-11-03T17:00:00"
    rumor = period("event_the_rumor")
    assert rumor.start is None and rumor.end is None
    assert times["event_a_name_forgotten"].spans == []

    lost = moment("event_the_lost_hour")
    assert lost.timestamp is None
    assert lost.unresolved == UnresolvedTime(
        code="no_time", event_ids=["event_a_name_forgotten"]
    )
    between = moment("event_between_the_knocks")
    assert between.unresolved == UnresolvedTime(
        code="several_spans", event_ids=["event_the_three_knocks"]
    )
    since = moment("event_since_the_grudge")
    assert since.unresolved == UnresolvedTime(
        code="bound_absent", event_ids=["event_the_old_grudge"]
    )

    contradiction = period("event_the_contradiction")
    assert contradiction.ends_before_start is True
    assert contradiction.start is not None and contradiction.end is not None
    assert contradiction.start.timestamp == "1012-11-03T21:00:00"
    assert contradiction.end.timestamp == "1000-01-01T00:00:00"

    calder = "entity_lord_calder"
    calder_events = {
        event.id for event in document.events if calder in event.entity_ids
    }
    assert {"event_the_dance", "event_the_argument"} <= calder_events
    hall = "entity_the_hall"
    assert sum(hall in event.entity_ids for event in document.events) >= 3
    assert any(event.entity_ids == [] for event in document.events)

    arcs = {arc.id: list(arc.event_ids) for arc in document.arcs}
    assert "event_the_toast" in arcs["arc_the_old_claim"]
    assert "event_the_toast" in arcs["arc_the_night"]
    assert "event_a_name_forgotten" in arcs["arc_the_old_claim"]
    assert arcs["arc_told_backwards"] == [
        "event_the_argument",
        "event_the_dance",
        "event_the_feast",
    ]
    in_an_arc = {event_id for event_ids in arcs.values() for event_id in event_ids}
    assert "event_the_bell" not in in_an_arc


def test_statement_times_resolve_property_and_assertion_spans() -> None:
    """The same point reading as the Event times, in document order."""
    document = StoryDocument.model_validate(
        {
            "events": [
                {
                    "id": "event_untimed",
                    "title": "Untimed",
                    "when": [],
                }
            ],
            "properties": [
                {
                    "id": "prop_open",
                    "entity_id": "entity_mara",
                    "statement": "Open",
                    "when": [],
                },
                {
                    "id": "prop_backwards",
                    "entity_id": "entity_mara",
                    "statement": "Backwards",
                    "when": [
                        {
                            "kind": "range",
                            "start": {"timestamp": "1847-06-01"},
                            "end": {"event_id": "event_untimed", "edge": "end"},
                        },
                        {
                            "kind": "range",
                            "start": {"timestamp": "1847-06-01"},
                            "end": {"timestamp": "1847-03-02"},
                        },
                    ],
                },
            ],
            "assertions": [
                {
                    "id": "assertion_seen",
                    "entity_ids": ["entity_mara", "entity_john"],
                    "statement": "Seen",
                    "when": [{"kind": "at", "at": {"timestamp": "1847-03-02T09:00"}}],
                }
            ],
        }
    )
    result = statement_times(document)
    assert [item.id for item in result.properties] == ["prop_open", "prop_backwards"]
    assert result.properties[0].spans == []
    backwards = result.properties[1].spans[0]
    assert isinstance(backwards, EventTimeRange)
    assert backwards.ends_before_start is False
    assert backwards.end is not None
    assert backwards.end.unresolved == UnresolvedTime(
        code="no_time", event_ids=["event_untimed"]
    )
    assert backwards.start is not None
    assert backwards.start.timestamp == "1847-06-01T00:00:00"
    reversed_span = result.properties[1].spans[1]
    assert isinstance(reversed_span, EventTimeRange)
    assert reversed_span.ends_before_start is True
    seen = result.assertions[0].spans[0]
    assert isinstance(seen, EventTimeAt)
    assert seen.at.timestamp == "1847-03-02T09:00:00"
