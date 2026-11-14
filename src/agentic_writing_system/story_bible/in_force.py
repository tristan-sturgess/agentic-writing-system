"""Which Properties and Assertions are in force at a query point.

Pure functions over a ``StoryDocument``. Nothing here is stored. The rules are
the ones in ``docs/story-bible.md`` ("What is in force"), and ``in_force``
builds the body ``docs/architecture/application.md`` specifies for
``GET /stories/{story_id}/in-force``. ``in_force_stretches`` builds the body of
``GET /stories/{story_id}/in-force-stretches``: the same reading, split where
one Entity's set changes. A time point is read with ``resolve_point``, the
same function the Event times use.
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


class InForceStretch(BaseModel):
    """One stretch of story time in which an Entity's in-force set stays put."""

    model_config = _SENT_WHOLE

    # Null when the stretch begins before every resolved bound.
    start: str | None = None
    # Null when the stretch runs on with no further bound.
    end: str | None = None
    statements: list[InForceStatement]


class InForceStretches(BaseModel):
    """The stretches body: the Entity, and one entry per stretch, in order."""

    model_config = _SENT_WHOLE

    entity_id: str
    stretches: list[InForceStretch]


def in_force(document: StoryDocument, point: TimePoint) -> InForce:
    """The statements in force at ``point``.

    A timestamp is that moment. A point that names an Event must carry ``edge``,
    because a query sits in no span that would supply one. The statements are
    the Properties in document order, then the Assertions in document order.
    A range left open stays in force.
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


def in_force_stretches(document: StoryDocument, entity_id: str) -> InForceStretches:
    """The stretches in which ``entity_id``'s in-force set stays the same.

    A cut is a resolved start or end of a range on that Entity's Properties or
    on an Assertion that names it. An ``at`` span and a bound that does not
    resolve are not cuts. The stretch before the first cut, each stretch from
    a cut until the next, and the stretch from the last cut onward are read
    with the same comparison as ``in_force``. Successive stretches with the
    same statements, marks included, are one stretch. A range with a start and
    an end is three stretches when nothing else cuts them.
    """
    if not any(entity.id == entity_id for entity in document.entities):
        msg = f"No Entity with id {entity_id}."
        raise ValueError(msg)
    owned = _owned(document, entity_id)
    cuts = sorted(
        {
            stamp
            for _statement_id, _kind, spans in owned
            for stamp in _bound_timestamps(spans)
        }
    )
    regions = [_region(owned, None, cuts[0] if cuts else None, "")]
    for index, stamp in enumerate(cuts):
        end = cuts[index + 1] if index + 1 < len(cuts) else None
        regions.append(_region(owned, stamp, end, stamp))
    merged: list[InForceStretch] = []
    for stretch in regions:
        previous = merged[-1] if merged else None
        if previous is not None and _signature(previous.statements) == _signature(
            stretch.statements
        ):
            merged[-1] = merged[-1].model_copy(update={"end": stretch.end})
        else:
            merged.append(stretch)
    return InForceStretches(entity_id=entity_id, stretches=merged)


def _owned(
    document: StoryDocument, entity_id: str
) -> list[tuple[str, StatementKind, list[EventTimeSpan]]]:
    """This Entity's statements, Properties then Assertions, in document order."""
    timed = statement_times(document)
    owned: list[tuple[str, StatementKind, list[EventTimeSpan]]] = []
    for prop, spans in zip(document.properties, timed.properties, strict=True):
        if prop.entity_id == entity_id:
            owned.append((prop.id, "property", spans.spans))
    for assertion, spans in zip(document.assertions, timed.assertions, strict=True):
        if entity_id in assertion.entity_ids:
            owned.append((assertion.id, "assertion", spans.spans))
    return owned


def _bound_timestamps(spans: list[EventTimeSpan]) -> list[str]:
    """Resolved range bounds. An ``at`` and an unresolved bound contribute none."""
    found: list[str] = []
    for span in spans:
        if not isinstance(span, EventTimeRange):
            continue
        for point in (span.start, span.end):
            if point is not None and point.timestamp is not None:
                found.append(point.timestamp)
    return found


def _region(
    owned: list[tuple[str, StatementKind, list[EventTimeSpan]]],
    start: str | None,
    end: str | None,
    probe: str,
) -> InForceStretch:
    """One stretch, probed at ``probe``. ``""`` sorts before every timestamp."""
    statements: list[InForceStatement] = []
    for statement_id, kind, spans in owned:
        included, marks = _included(spans, probe)
        if included:
            statements.append(
                InForceStatement(id=statement_id, kind=kind, unresolved=marks)
            )
    return InForceStretch(start=start, end=end, statements=statements)


def _signature(
    statements: list[InForceStatement],
) -> tuple[tuple[str, tuple[tuple[int, str, str, tuple[str, ...]], ...]], ...]:
    return tuple(
        (
            statement.id,
            tuple(
                (
                    mark.span,
                    mark.bound,
                    mark.unresolved.code,
                    tuple(mark.unresolved.event_ids),
                )
                for mark in statement.unresolved
            ),
        )
        for statement in statements
    )


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
