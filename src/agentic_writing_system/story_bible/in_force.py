"""Which Properties and Assertions are in force at a query point.

Pure functions over a ``StoryDocument``. Nothing here is stored. The rules are
the ones in ``docs/story-bible.md`` ("What is in force"), and ``in_force``
builds the body ``docs/architecture/application.md`` specifies for
``GET /stories/{story_id}/in-force``. A time point is read with
``resolve_point``, the same function the Event times use.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from agentic_writing_system.story_bible.records import (
    EventPoint,
    StoryDocument,
    TimePoint,
)
from agentic_writing_system.story_bible.story_time import (
    EventTimePoint,
    EventTimeRange,
    EventTimeSpan,
    UnresolvedTime,
    resolve_point,
    statement_times,
)

_SENT_WHOLE = ConfigDict(
    extra="forbid", json_schema_serialization_defaults_required=True
)

type StatementKind = Literal["property", "assertion"]
type _BoundName = Literal["start", "end"]
type _Side = Literal["open", "inside", "excludes", "unresolved"]


class UnresolvedComparison(BaseModel):
    """One bound of one span whose comparison did not resolve."""

    model_config = _SENT_WHOLE

    # The span's position in the statement's ``when`` list.
    span: int
    bound: _BoundName
    unresolved: UnresolvedTime


class InForceStatement(BaseModel):
    """A Property or Assertion the reading includes at the query point."""

    model_config = _SENT_WHOLE

    id: str
    kind: StatementKind
    # Empty when every comparison the reading used had resolved.
    unresolved: list[UnresolvedComparison] = Field(default_factory=list)


class InForce(BaseModel):
    """The in-force body: the query as read, and the statements it includes."""

    model_config = _SENT_WHOLE

    query: EventTimePoint
    statements: list[InForceStatement]


def in_force(document: StoryDocument, point: TimePoint) -> InForce:
    """The statements in force at ``point``.

    A timestamp is that moment. A point that names an Event must carry ``edge``,
    because a query sits in no span that would supply one. The statements are
    the Properties in document order, then the Assertions in document order.
    ``supersedes`` is not read: a range left open stays in force.
    """
    if isinstance(point, EventPoint) and point.edge is None:
        msg = "an in-force query that names an Event must give an edge"
        raise ValueError(msg)
    reading = resolve_point(document, point, "at")
    query = EventTimePoint(
        point=point,
        edge=reading.edge,
        timestamp=reading.timestamp,
        unresolved=reading.unresolved,
    )
    timed = statement_times(document)
    statements: list[InForceStatement] = []
    for prop, spans in zip(document.properties, timed.properties, strict=True):
        included, marks = _included(spans.spans, reading.timestamp)
        if included:
            statements.append(
                InForceStatement(id=prop.id, kind="property", unresolved=marks)
            )
    for assertion, spans in zip(document.assertions, timed.assertions, strict=True):
        included, marks = _included(spans.spans, reading.timestamp)
        if included:
            statements.append(
                InForceStatement(id=assertion.id, kind="assertion", unresolved=marks)
            )
    return InForce(query=query, statements=statements)


def _included(
    spans: list[EventTimeSpan], query_ts: str | None
) -> tuple[bool, list[UnresolvedComparison]]:
    """Whether the statement is in the list, and the comparisons left open.

    An empty ``when`` holds at every query point, including one that does not
    resolve. With no query timestamp, a range with neither bound does too, and
    every other span needs a timestamp to compare, so it contributes nothing.
    """
    if not spans:
        return True, []
    if query_ts is None:
        holds = any(
            isinstance(span, EventTimeRange) and span.start is None and span.end is None
            for span in spans
        )
        return holds, []

    included = False
    marks: list[UnresolvedComparison] = []
    for index, span in enumerate(spans):
        if not isinstance(span, EventTimeRange):
            continue
        verdict, span_marks = _range_verdict(span, index, query_ts)
        if verdict == "excludes":
            continue
        included = True
        marks.extend(span_marks)
    return included, marks


def _range_verdict(
    span: EventTimeRange, index: int, query_ts: str
) -> tuple[Literal["covers", "excludes", "unresolved"], list[UnresolvedComparison]]:
    """How one range meets the query. A bound that places the point outside wins."""
    start = _side(span.start, query_ts, "start")
    end = _side(span.end, query_ts, "end")
    if start[0] == "excludes" or end[0] == "excludes":
        return "excludes", []
    marks: list[UnresolvedComparison] = []
    sides: tuple[tuple[_BoundName, tuple[_Side, UnresolvedTime | None]], ...] = (
        ("start", start),
        ("end", end),
    )
    for bound, side in sides:
        reason = side[1]
        if reason is None:
            continue
        marks.append(UnresolvedComparison(span=index, bound=bound, unresolved=reason))
    if marks:
        return "unresolved", marks
    return "covers", []


def _side(
    point: EventTimePoint | None, query_ts: str, bound: _BoundName
) -> tuple[_Side, UnresolvedTime | None]:
    """One bound against the query. Absent is open. Unresolved carries its reason."""
    if point is None:
        return "open", None
    if point.timestamp is None:
        if point.unresolved is None:
            msg = "a time point with no timestamp and no reason"
            raise ValueError(msg)
        return "unresolved", point.unresolved
    if bound == "start":
        return ("inside" if query_ts >= point.timestamp else "excludes"), None
    return ("inside" if query_ts < point.timestamp else "excludes"), None
