"""Resolve story time from the spans on a document.

Pure functions over a ``StoryDocument``. Nothing here is stored. The rules are
the ones in ``docs/story-bible.md`` ("A time point that names an Event").
``event_times`` and ``statement_times`` build the bodies
``docs/architecture/application.md`` specifies for the event-times and
statement-times reads. The in-force view and the slice 3 read tools call
``resolve_point`` rather than reading a span themselves.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from agentic_writing_system.story_bible.records import (
    AtSpan,
    Event,
    EventPoint,
    Span,
    StoryDocument,
    TimePoint,
    TimestampPoint,
    timestamp_value,
)

# A field with a default is still sent on every response, as the story views do.
# The generated client types then do not treat it as optional.
_SENT_WHOLE = ConfigDict(
    extra="forbid", json_schema_serialization_defaults_required=True
)

type PointPlace = Literal["at", "start", "end"]
type EventEdge = Literal["start", "end"]
type UnresolvedCode = Literal["no_time", "several_spans", "bound_absent"]


class UnresolvedTime(BaseModel):
    """Why a time point did not resolve, and the Events followed to get there."""

    model_config = _SENT_WHOLE

    code: UnresolvedCode
    # The Events the point named, in the order followed, ending at the one that
    # stopped the chain.
    event_ids: list[str]


class EventTimePoint(BaseModel):
    """One stored time point, read by the story-time rules."""

    model_config = _SENT_WHOLE

    point: TimePoint
    # The end the point was read as. Null when the point is a timestamp.
    edge: EventEdge | None = None
    # YYYY-MM-DDTHH:MM:SS, or null when the point does not resolve.
    timestamp: str | None = None
    unresolved: UnresolvedTime | None = None


class EventTimeAt(BaseModel):
    """An at span with its point resolved."""

    model_config = _SENT_WHOLE

    kind: Literal["at"] = "at"
    at: EventTimePoint


class EventTimeRange(BaseModel):
    """A range span. A bound the span does not store is null here too."""

    model_config = _SENT_WHOLE

    kind: Literal["range"] = "range"
    start: EventTimePoint | None = None
    end: EventTimePoint | None = None
    # True when both bounds resolve and the start is after the end. A save does
    # not refuse that when a bound is an Event; this is where it is reported.
    ends_before_start: bool = False


EventTimeSpan = Annotated[
    EventTimeAt | EventTimeRange,
    Field(discriminator="kind"),
]


class EventTime(BaseModel):
    """One Event's spans, in the order its when list stores them."""

    model_config = _SENT_WHOLE

    id: str
    spans: list[EventTimeSpan]


class EventTimes(BaseModel):
    """The event-times body: every Event, in the story document's order."""

    model_config = _SENT_WHOLE

    events: list[EventTime]


class StatementTime(BaseModel):
    """One Property or Assertion, its spans in the order ``when`` stores them."""

    model_config = _SENT_WHOLE

    id: str
    spans: list[EventTimeSpan]


class StatementTimes(BaseModel):
    """The statement-times body: every Property, then every Assertion."""

    model_config = _SENT_WHOLE

    properties: list[StatementTime]
    assertions: list[StatementTime]


@dataclass(frozen=True)
class PointReading:
    """How one time point reads. ``edge`` is null when the point is a timestamp."""

    edge: EventEdge | None
    timestamp: str | None
    unresolved: UnresolvedTime | None


def normalized_timestamp(timestamp: str) -> str:
    """The timestamp as ``YYYY-MM-DDTHH:MM:SS``, so two values compare as text.

    A date alone is the start of that day. The year is four digits, including a
    year below 1000. ``strftime`` does not pad those years on Windows.
    """
    moment = timestamp_value(timestamp)
    return (
        f"{moment.year:04d}-{moment.month:02d}-{moment.day:02d}"
        f"T{moment.hour:02d}:{moment.minute:02d}:{moment.second:02d}"
    )


def resolve_point(
    document: StoryDocument, point: TimePoint, place: PointPlace
) -> PointReading:
    """Read one time point as the edge it means and the timestamp it reaches.

    ``place`` is where the point sits: ``at`` on an at span, or ``start`` or
    ``end`` on a range. A point that names an Event and stores no edge is the
    Event's end when it is a range's start, and the Event's start when it is a
    range's end. An at span has no such default; the rules refuse one that
    names an Event without an edge.

    A timestamp resolves to its normalised value. A point that names an Event
    follows that Event's single span, and the same rules again, until it
    reaches a timestamp or a reason it cannot. The reason's ``event_ids`` are
    the Events followed, ending at the one that stopped the chain.
    """
    return _read_point(_events_by_id(document), point, place)


def event_times(document: StoryDocument) -> EventTimes:
    """Each Event's spans, with every stored point resolved."""
    events = _events_by_id(document)
    return EventTimes(
        events=[
            EventTime(id=event.id, spans=_read_spans(events, event.when))
            for event in document.events
        ]
    )


def statement_times(document: StoryDocument) -> StatementTimes:
    """Each Property and Assertion span, with every stored point resolved."""
    events = _events_by_id(document)
    return StatementTimes(
        properties=[
            StatementTime(id=prop.id, spans=_read_spans(events, prop.when))
            for prop in document.properties
        ],
        assertions=[
            StatementTime(id=assertion.id, spans=_read_spans(events, assertion.when))
            for assertion in document.assertions
        ],
    )


def _events_by_id(document: StoryDocument) -> dict[str, Event]:
    return {event.id: event for event in document.events}


def _read_spans(events: dict[str, Event], when: list[Span]) -> list[EventTimeSpan]:
    """One entry per stored span, points resolved, absent bounds left absent."""
    spans: list[EventTimeSpan] = []
    for span in when:
        if isinstance(span, AtSpan):
            spans.append(EventTimeAt(at=_timed_point(events, span.at, "at")))
            continue
        start = (
            _timed_point(events, span.start, "start")
            if span.start is not None
            else None
        )
        end = _timed_point(events, span.end, "end") if span.end is not None else None
        spans.append(
            EventTimeRange(
                start=start,
                end=end,
                ends_before_start=_ends_before_start(start, end),
            )
        )
    return spans


def _edge_for(point: EventPoint, place: PointPlace) -> EventEdge:
    """The end of the named Event this point means."""
    if point.edge is not None:
        return point.edge
    if place == "start":
        return "end"
    if place == "end":
        return "start"
    msg = "an at span that names an Event must give an edge"
    raise ValueError(msg)


def _read_point(
    events: dict[str, Event], point: TimePoint, place: PointPlace
) -> PointReading:
    if isinstance(point, TimestampPoint):
        return PointReading(
            edge=None,
            timestamp=normalized_timestamp(point.timestamp),
            unresolved=None,
        )
    edge = _edge_for(point, place)
    timestamp, unresolved = _resolve_edge(events, point.event_id, edge, [])
    return PointReading(edge=edge, timestamp=timestamp, unresolved=unresolved)


def _resolve_edge(
    events: dict[str, Event],
    event_id: str,
    edge: EventEdge,
    followed: list[str],
) -> tuple[str | None, UnresolvedTime | None]:
    # A saved story has no span cycle and no dangling Event id. Either one here
    # is a document the rules would have refused, so it is not a reason code.
    if event_id in followed:
        cycle = " > ".join([*followed, event_id])
        msg = f"span cycle while resolving story time: {cycle}"
        raise ValueError(msg)
    try:
        event = events[event_id]
    except KeyError:
        msg = f"time point names unknown Event {event_id}"
        raise ValueError(msg) from None

    chain = [*followed, event_id]
    when = event.when
    if not when:
        return None, UnresolvedTime(code="no_time", event_ids=chain)
    if len(when) > 1:
        return None, UnresolvedTime(code="several_spans", event_ids=chain)

    span = when[0]
    if isinstance(span, AtSpan):
        bound: TimePoint | None = span.at
        bound_place: PointPlace = "at"
    elif edge == "start":
        bound = span.start
        bound_place = "start"
    else:
        bound = span.end
        bound_place = "end"

    if bound is None:
        return None, UnresolvedTime(code="bound_absent", event_ids=chain)
    if isinstance(bound, TimestampPoint):
        return normalized_timestamp(bound.timestamp), None
    return _resolve_edge(events, bound.event_id, _edge_for(bound, bound_place), chain)


def _timed_point(
    events: dict[str, Event], point: TimePoint, place: PointPlace
) -> EventTimePoint:
    reading = _read_point(events, point, place)
    return EventTimePoint(
        point=point,
        edge=reading.edge,
        timestamp=reading.timestamp,
        unresolved=reading.unresolved,
    )


def _ends_before_start(
    start: EventTimePoint | None, end: EventTimePoint | None
) -> bool:
    if start is None or end is None:
        return False
    if start.timestamp is None or end.timestamp is None:
        return False
    return start.timestamp > end.timestamp
