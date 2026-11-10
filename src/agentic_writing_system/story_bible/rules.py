"""Story Bible validation rules and refusal payloads."""

from __future__ import annotations

from collections.abc import Collection, Iterable
from typing import Literal, cast

from pydantic import BaseModel, ConfigDict

from agentic_writing_system.story_bible.records import (
    DOCUMENT_LISTS,
    PRIMARY_TEXT_FIELDS,
    Arc,
    Assertion,
    AtSpan,
    Event,
    EventPoint,
    NarrativeUnit,
    Property,
    RangeSpan,
    Record,
    RecordKind,
    Span,
    StoryDocument,
    TimestampPoint,
    timestamp_value,
)

_FORBID = ConfigDict(extra="forbid")

RuleProblemCode = Literal[
    "duplicate_id",
    "blank_primary_text",
    "unknown_id",
    "delete_still_named",
    "assertion_needs_two",
    "supersedes_self",
    "supersedes_other_entity",
    "unit_not_placed",
    "unit_placed_twice",
    "unit_contains_itself",
    "duplicate_in_list",
    "range_start_after_end",
    "span_cycle",
]

ApplyProblemCode = Literal[
    "unknown_ref",
    "duplicate_ref",
    "blank_primary_text",
    "unknown_id",
    "kind_mismatch",
]

# Found by the commit and the import, which read more than one document.
CommitProblemCode = Literal["schema_version", "kind_changed"]

ProblemCode = RuleProblemCode | ApplyProblemCode | CommitProblemCode


class Problem(BaseModel):
    model_config = _FORBID

    code: ProblemCode
    message: str
    record_id: str | None = None
    field: str | None = None
    write_index: int | None = None
    ids: list[str] = []
    legal_ids: list[str] = []
    referring: list[str] = []


class Refusal(BaseModel):
    model_config = _FORBID

    message: str
    problems: list[Problem]


_ALL_KINDS: tuple[RecordKind, ...] = tuple(DOCUMENT_LISTS)


def _owner(record_id: str | None) -> str:
    return "The story" if record_id is None else record_id


def _append_unique(ids: list[str], value: str) -> None:
    if value and value not in ids:
        ids.append(value)


def _event_ids_in_when(when: Iterable[Span]) -> list[str]:
    result: list[str] = []
    for span in when:
        points: list[EventPoint | None] = []
        if isinstance(span, AtSpan):
            if isinstance(span.at, EventPoint):
                points.append(span.at)
        elif isinstance(span, RangeSpan):
            if span.start is not None and isinstance(span.start, EventPoint):
                points.append(span.start)
            if span.end is not None and isinstance(span.end, EventPoint):
                points.append(span.end)
        for pt in points:
            if pt is not None:
                _append_unique(result, pt.event_id)
    return result


def named_ids(record: Record) -> list[str]:
    """Every id the record names, without duplicates, in a stable order."""
    result: list[str] = []
    if isinstance(record, Assertion):
        for eid in record.entity_ids:
            _append_unique(result, eid)
        for eid in record.event_ids:
            _append_unique(result, eid)
        for aid in record.arc_ids:
            _append_unique(result, aid)
    elif isinstance(record, Event):
        for eid in record.entity_ids:
            _append_unique(result, eid)
    elif isinstance(record, Arc):
        for eid in record.event_ids:
            _append_unique(result, eid)
    elif isinstance(record, NarrativeUnit):
        for cid in record.child_ids:
            _append_unique(result, cid)
        for sid in record.subject_ids:
            _append_unique(result, sid)
    elif isinstance(record, Property):
        _append_unique(result, record.entity_id)
        if record.caused_by is not None:
            _append_unique(result, record.caused_by)
        if record.supersedes is not None:
            _append_unique(result, record.supersedes)
    if isinstance(record, (Property, Assertion, Event)):
        for eid in _event_ids_in_when(record.when):
            _append_unique(result, eid)
    return result


def story_named_ids(document: StoryDocument) -> list[str]:
    return list(document.unit_ids)


def _all_records(document: StoryDocument) -> list[Record]:
    records: list[Record] = []
    for attr in DOCUMENT_LISTS.values():
        records.extend(getattr(document, attr))
    return records


def _ids_for_kinds(document: StoryDocument, kinds: tuple[RecordKind, ...]) -> list[str]:
    legal: list[str] = []
    for kind in kinds:
        attr = DOCUMENT_LISTS[kind]
        for rec in getattr(document, attr):
            legal.append(rec.id)
    return legal


def _properties_by_id(document: StoryDocument) -> dict[str, Property]:
    return {p.id: p for p in document.properties}


def _events_by_id(document: StoryDocument) -> dict[str, Event]:
    return {e.id: e for e in document.events}


def _units_by_id(document: StoryDocument) -> dict[str, NarrativeUnit]:
    return {u.id: u for u in document.units}


def _unknown_in_list(
    *,
    record_id: str | None,
    field: str,
    values: list[str],
    legal_ids: list[str],
    legal_set: set[str],
    deleted_ids: set[str],
) -> list[Problem]:
    unknown = [v for v in values if v not in legal_set and v not in deleted_ids]
    if not unknown:
        return []
    return [
        Problem(
            code="unknown_id",
            message=(
                f"{_owner(record_id)} names ids in {field} that do not exist "
                f"for that field: {', '.join(unknown)}."
            ),
            record_id=record_id,
            field=field,
            ids=unknown,
            legal_ids=legal_ids,
        )
    ]


def _unknown_scalar(
    *,
    record_id: str,
    field: str,
    value: str | None,
    legal_ids: list[str],
    legal_set: set[str],
    deleted_ids: set[str],
) -> list[Problem]:
    if value is None or value in legal_set or value in deleted_ids:
        return []
    return [
        Problem(
            code="unknown_id",
            message=(
                f"{record_id} names an id in {field} that does not exist "
                f"for that field: {value}."
            ),
            record_id=record_id,
            field=field,
            ids=[value],
            legal_ids=legal_ids,
        )
    ]


def _check_unknown_ids_for_record(
    document: StoryDocument,
    record: Record,
    deleted_ids: set[str],
) -> list[Problem]:
    problems: list[Problem] = []
    rid = record.id

    if isinstance(record, Property):
        legal_entity = _ids_for_kinds(document, ("entity",))
        problems.extend(
            _unknown_scalar(
                record_id=rid,
                field="entity_id",
                value=record.entity_id,
                legal_ids=legal_entity,
                legal_set=set(legal_entity),
                deleted_ids=deleted_ids,
            )
        )
        legal_event = _ids_for_kinds(document, ("event",))
        problems.extend(
            _unknown_scalar(
                record_id=rid,
                field="caused_by",
                value=record.caused_by,
                legal_ids=legal_event,
                legal_set=set(legal_event),
                deleted_ids=deleted_ids,
            )
        )
        legal_prop = _ids_for_kinds(document, ("property",))
        problems.extend(
            _unknown_scalar(
                record_id=rid,
                field="supersedes",
                value=record.supersedes,
                legal_ids=legal_prop,
                legal_set=set(legal_prop),
                deleted_ids=deleted_ids,
            )
        )
        problems.extend(_check_when_unknown(document, rid, record.when, deleted_ids))
    elif isinstance(record, Assertion):
        for field, kinds in (
            ("entity_ids", ("entity",)),
            ("event_ids", ("event",)),
            ("arc_ids", ("arc",)),
        ):
            legal = _ids_for_kinds(document, cast(tuple[RecordKind, ...], kinds))
            values = getattr(record, field)
            problems.extend(
                _unknown_in_list(
                    record_id=rid,
                    field=field,
                    values=values,
                    legal_ids=legal,
                    legal_set=set(legal),
                    deleted_ids=deleted_ids,
                )
            )
        legal_event = _ids_for_kinds(document, ("event",))
        problems.extend(
            _unknown_scalar(
                record_id=rid,
                field="caused_by",
                value=record.caused_by,
                legal_ids=legal_event,
                legal_set=set(legal_event),
                deleted_ids=deleted_ids,
            )
        )
        legal_assertion = _ids_for_kinds(document, ("assertion",))
        problems.extend(
            _unknown_scalar(
                record_id=rid,
                field="supersedes",
                value=record.supersedes,
                legal_ids=legal_assertion,
                legal_set=set(legal_assertion),
                deleted_ids=deleted_ids,
            )
        )
        problems.extend(_check_when_unknown(document, rid, record.when, deleted_ids))
    elif isinstance(record, Event):
        legal_entity = _ids_for_kinds(document, ("entity",))
        problems.extend(
            _unknown_in_list(
                record_id=rid,
                field="entity_ids",
                values=record.entity_ids,
                legal_ids=legal_entity,
                legal_set=set(legal_entity),
                deleted_ids=deleted_ids,
            )
        )
        problems.extend(_check_when_unknown(document, rid, record.when, deleted_ids))
    elif isinstance(record, Arc):
        legal_event = _ids_for_kinds(document, ("event",))
        problems.extend(
            _unknown_in_list(
                record_id=rid,
                field="event_ids",
                values=record.event_ids,
                legal_ids=legal_event,
                legal_set=set(legal_event),
                deleted_ids=deleted_ids,
            )
        )
    elif isinstance(record, NarrativeUnit):
        legal_unit = _ids_for_kinds(document, ("unit",))
        problems.extend(
            _unknown_in_list(
                record_id=rid,
                field="child_ids",
                values=record.child_ids,
                legal_ids=legal_unit,
                legal_set=set(legal_unit),
                deleted_ids=deleted_ids,
            )
        )
        legal_subject = _ids_for_kinds(document, ("entity", "event", "arc"))
        problems.extend(
            _unknown_in_list(
                record_id=rid,
                field="subject_ids",
                values=record.subject_ids,
                legal_ids=legal_subject,
                legal_set=set(legal_subject),
                deleted_ids=deleted_ids,
            )
        )
    return problems


def _check_when_unknown(
    document: StoryDocument,
    record_id: str,
    when: list[Span],
    deleted_ids: set[str],
) -> list[Problem]:
    legal_event = _ids_for_kinds(document, ("event",))
    legal_set = set(legal_event)
    unknown: list[str] = []
    for eid in _event_ids_in_when(when):
        if eid not in legal_set and eid not in deleted_ids:
            if not any(v == eid for v in unknown):
                unknown.append(eid)
    if not unknown:
        return []
    return [
        Problem(
            code="unknown_id",
            message=(
                f"{record_id} uses Event ids as time points in when that do not "
                f"exist: {', '.join(unknown)}."
            ),
            record_id=record_id,
            field="when",
            ids=unknown,
            legal_ids=legal_event,
        )
    ]


def _check_story_unit_ids(
    document: StoryDocument,
    deleted_ids: set[str],
) -> list[Problem]:
    legal_unit = _ids_for_kinds(document, ("unit",))
    return _unknown_in_list(
        record_id=None,
        field="unit_ids",
        values=document.unit_ids,
        legal_ids=legal_unit,
        legal_set=set(legal_unit),
        deleted_ids=deleted_ids,
    )


def _find_duplicate_ids(document: StoryDocument) -> list[Problem]:
    seen: dict[str, int] = {}
    for kind in DOCUMENT_LISTS:
        for rec in getattr(document, DOCUMENT_LISTS[kind]):
            seen[rec.id] = seen.get(rec.id, 0) + 1
    problems: list[Problem] = []
    for record_id, count in sorted(seen.items()):
        if count > 1:
            problems.append(
                Problem(
                    code="duplicate_id",
                    message=f"More than one record has the id {record_id}.",
                    record_id=record_id,
                    ids=[record_id],
                )
            )
    return problems


def _find_blank_primary_text(document: StoryDocument) -> list[Problem]:
    problems: list[Problem] = []
    for kind, attr in DOCUMENT_LISTS.items():
        field_name = PRIMARY_TEXT_FIELDS[kind]
        for rec in getattr(document, attr):
            text = getattr(rec, field_name)
            if not text or text.isspace():
                problems.append(
                    Problem(
                        code="blank_primary_text",
                        message=f"{rec.id} has a blank {field_name}.",
                        record_id=rec.id,
                        field=field_name,
                    )
                )
    return problems


def _find_assertion_needs_two(document: StoryDocument) -> list[Problem]:
    problems: list[Problem] = []
    for assertion in document.assertions:
        named: set[str] = set()
        named.update(assertion.entity_ids)
        named.update(assertion.event_ids)
        named.update(assertion.arc_ids)
        if len(named) < 2:
            problems.append(
                Problem(
                    code="assertion_needs_two",
                    message=(
                        f"{assertion.id} names fewer than two records. An "
                        "Assertion names at least two Entities, Events, or Arcs."
                    ),
                    record_id=assertion.id,
                    ids=sorted(named),
                )
            )
    return problems


def _find_supersedes_self(document: StoryDocument) -> list[Problem]:
    problems: list[Problem] = []
    for prop in document.properties:
        if prop.supersedes == prop.id:
            problems.append(
                Problem(
                    code="supersedes_self",
                    message=f"{prop.id} supersedes itself.",
                    record_id=prop.id,
                    field="supersedes",
                    ids=[prop.id],
                )
            )
    for assertion in document.assertions:
        if assertion.supersedes == assertion.id:
            problems.append(
                Problem(
                    code="supersedes_self",
                    message=f"{assertion.id} supersedes itself.",
                    record_id=assertion.id,
                    field="supersedes",
                    ids=[assertion.id],
                )
            )
    return problems


def _find_supersedes_other_entity(document: StoryDocument) -> list[Problem]:
    by_id = _properties_by_id(document)
    problems: list[Problem] = []
    for prop in document.properties:
        if prop.supersedes is None:
            continue
        other = by_id.get(prop.supersedes)
        if other is None:
            continue
        if other.entity_id != prop.entity_id:
            problems.append(
                Problem(
                    code="supersedes_other_entity",
                    message=(
                        f"{prop.id} belongs to {prop.entity_id} and supersedes "
                        f"{prop.supersedes}, which belongs to {other.entity_id}. "
                        "A Property supersedes a Property of the same Entity."
                    ),
                    record_id=prop.id,
                    field="supersedes",
                    ids=[prop.supersedes],
                )
            )
    return problems


def _find_unit_placement_problems(document: StoryDocument) -> list[Problem]:
    problems: list[Problem] = []
    for unit in document.units:
        story_count = document.unit_ids.count(unit.id)
        child_refs = [
            parent.id
            for parent in document.units
            for cid in parent.child_ids
            if cid == unit.id
        ]
        total = story_count + len(child_refs)
        if total == 0:
            problems.append(
                Problem(
                    code="unit_not_placed",
                    message=(
                        f"{unit.id} is in no list. A Narrative Unit is in the "
                        "story's unit_ids or in one unit's child_ids."
                    ),
                    record_id=unit.id,
                )
            )
        elif total > 1:
            referring: list[str] = ["story"] * story_count + child_refs
            problems.append(
                Problem(
                    code="unit_placed_twice",
                    message=(
                        f"{unit.id} is listed more than once, in: "
                        f"{', '.join(referring)}. A Narrative Unit is in exactly "
                        "one list, once."
                    ),
                    record_id=unit.id,
                    referring=referring,
                )
            )
    return problems


def _find_unit_contains_itself(document: StoryDocument) -> list[Problem]:
    units = _units_by_id(document)
    problems: list[Problem] = []

    for unit in document.units:
        unit_id = unit.id
        if unit_id in unit.child_ids:
            problems.append(
                Problem(
                    code="unit_contains_itself",
                    message=f"{unit_id} lists itself in child_ids.",
                    record_id=unit_id,
                    field="child_ids",
                    ids=[unit_id, unit_id],
                )
            )
            continue

        def visit(root_id: str, current: str, path: list[str]) -> list[str] | None:
            if current == root_id:
                return path + [root_id]
            child = units.get(current)
            if child is None:
                return None
            for cid in child.child_ids:
                if cid in path:
                    continue
                found = visit(root_id, cid, path + [current])
                if found is not None:
                    return found
            return None

        for cid in unit.child_ids:
            cycle = visit(unit_id, cid, [unit_id])
            if cycle is not None:
                problems.append(
                    Problem(
                        code="unit_contains_itself",
                        message=(
                            f"{unit_id} contains itself through child_ids: "
                            f"{' > '.join(cycle)}."
                        ),
                        record_id=unit_id,
                        field="child_ids",
                        ids=cycle,
                    )
                )
                break
    return problems


def _id_lists(record: Record) -> list[tuple[str, list[str]]]:
    """The lists of ids on a record that must not repeat an id.

    A unit's `child_ids` is not here: `unit_placed_twice` covers it, with a unit
    that sits in two different lists.
    """
    if isinstance(record, Assertion):
        return [
            ("entity_ids", record.entity_ids),
            ("event_ids", record.event_ids),
            ("arc_ids", record.arc_ids),
        ]
    if isinstance(record, Event):
        return [("entity_ids", record.entity_ids)]
    if isinstance(record, Arc):
        return [("event_ids", record.event_ids)]
    if isinstance(record, NarrativeUnit):
        return [("subject_ids", record.subject_ids)]
    return []


def _find_duplicates_in_lists(document: StoryDocument) -> list[Problem]:
    problems: list[Problem] = []
    for record in _all_records(document):
        for field, values in _id_lists(record):
            repeated: list[str] = []
            seen: set[str] = set()
            for value in values:
                if value in seen:
                    _append_unique(repeated, value)
                seen.add(value)
            if repeated:
                problems.append(
                    Problem(
                        code="duplicate_in_list",
                        message=(
                            f"{record.id} lists ids more than once in {field}: "
                            f"{', '.join(repeated)}. List each id once."
                        ),
                        record_id=record.id,
                        field=field,
                        ids=repeated,
                    )
                )
    return problems


def _find_ranges_that_start_after_they_end(document: StoryDocument) -> list[Problem]:
    """Only a range between two timestamps is checked.

    An Event bound depends on that Event's own spans. docs/story-bible.md lists
    the unchecked case as a known issue.
    """
    problems: list[Problem] = []
    for record in _all_records(document):
        if not isinstance(record, (Property, Assertion, Event)):
            continue
        for span in record.when:
            if not isinstance(span, RangeSpan):
                continue
            start, end = span.start, span.end
            if not isinstance(start, TimestampPoint):
                continue
            if not isinstance(end, TimestampPoint):
                continue
            if timestamp_value(start.timestamp) > timestamp_value(end.timestamp):
                problems.append(
                    Problem(
                        code="range_start_after_end",
                        message=(
                            f"{record.id} has a range in when that starts after "
                            f"it ends: start {start.timestamp}, end {end.timestamp}."
                        ),
                        record_id=record.id,
                        field="when",
                    )
                )
    return problems


def _span_cycle_chain(event_id: str, events: dict[str, Event]) -> list[str] | None:
    start = events.get(event_id)
    if start is None:
        return None
    if event_id in _event_ids_in_when(start.when):
        return [event_id, event_id]

    def explore(current: str, stack: list[str]) -> list[str] | None:
        current_event = events.get(current)
        if current_event is None:
            return None
        for ref in _event_ids_in_when(current_event.when):
            if ref == event_id:
                return stack + [current, event_id]
            if ref in stack:
                continue
            found = explore(ref, stack + [current])
            if found is not None:
                return found
        return None

    for ref in _event_ids_in_when(start.when):
        if ref in events:
            chain = explore(ref, [event_id])
            if chain is not None:
                return chain
    return None


def _find_span_cycles(document: StoryDocument) -> list[Problem]:
    events = _events_by_id(document)
    problems: list[Problem] = []
    for event in document.events:
        chain = _span_cycle_chain(event.id, events)
        if chain is not None:
            problems.append(
                Problem(
                    code="span_cycle",
                    message=(
                        f"{event.id} uses Events as time points that lead back "
                        f"to it: {' > '.join(chain)}."
                    ),
                    record_id=event.id,
                    field="when",
                    ids=chain,
                )
            )
    return problems


def _build_referrers(document: StoryDocument) -> dict[str, list[str]]:
    referrers: dict[str, list[str]] = {}

    def add(ref: str, from_id: str) -> None:
        referrers.setdefault(ref, []).append(from_id)

    for prop in document.properties:
        add(prop.entity_id, prop.id)
        if prop.caused_by:
            add(prop.caused_by, prop.id)
        if prop.supersedes:
            add(prop.supersedes, prop.id)
        for eid in _event_ids_in_when(prop.when):
            add(eid, prop.id)
    for assertion in document.assertions:
        for eid in assertion.entity_ids:
            add(eid, assertion.id)
        for eid in assertion.event_ids:
            add(eid, assertion.id)
        for aid in assertion.arc_ids:
            add(aid, assertion.id)
        if assertion.caused_by:
            add(assertion.caused_by, assertion.id)
        if assertion.supersedes:
            add(assertion.supersedes, assertion.id)
        for eid in _event_ids_in_when(assertion.when):
            add(eid, assertion.id)
    for event in document.events:
        for eid in event.entity_ids:
            add(eid, event.id)
        for eid in _event_ids_in_when(event.when):
            add(eid, event.id)
    for arc in document.arcs:
        for eid in arc.event_ids:
            add(eid, arc.id)
    for unit in document.units:
        for cid in unit.child_ids:
            add(cid, unit.id)
        for sid in unit.subject_ids:
            add(sid, unit.id)
    for uid in document.unit_ids:
        add(uid, "story")
    return referrers


def _find_delete_still_named(
    document: StoryDocument,
    deleted_ids: set[str],
) -> list[Problem]:
    if not deleted_ids:
        return []
    referrers = _build_referrers(document)
    problems: list[Problem] = []
    for deleted_id in sorted(deleted_ids):
        refs = sorted(
            set(referrers.get(deleted_id, [])), key=lambda x: (x != "story", x)
        )
        if refs:
            problems.append(
                Problem(
                    code="delete_still_named",
                    message=(
                        f"{deleted_id} cannot be deleted while other records "
                        f"name it: {', '.join(refs)}. Edit or delete those first."
                    ),
                    record_id=deleted_id,
                    ids=[deleted_id],
                    referring=refs,
                )
            )
    return problems


def check_document(
    document: StoryDocument,
    deleted_ids: Collection[str] = (),
) -> list[Problem]:
    """Return every rule violation, in a deterministic order, or an empty list."""
    # An id the writes deleted and then created again is a record of the document.
    deleted_set = set(deleted_ids) - set(_ids_for_kinds(document, _ALL_KINDS))
    problems: list[Problem] = []

    problems.extend(_find_duplicate_ids(document))
    problems.extend(_find_blank_primary_text(document))

    for kind in DOCUMENT_LISTS:
        for rec in getattr(document, DOCUMENT_LISTS[kind]):
            problems.extend(_check_unknown_ids_for_record(document, rec, deleted_set))

    problems.extend(_check_story_unit_ids(document, deleted_set))
    problems.extend(_find_delete_still_named(document, deleted_set))
    problems.extend(_find_assertion_needs_two(document))
    problems.extend(_find_supersedes_self(document))
    problems.extend(_find_supersedes_other_entity(document))
    problems.extend(_find_unit_placement_problems(document))
    problems.extend(_find_unit_contains_itself(document))
    problems.extend(_find_duplicates_in_lists(document))
    problems.extend(_find_ranges_that_start_after_they_end(document))
    problems.extend(_find_span_cycles(document))

    return problems
