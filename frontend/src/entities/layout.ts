// Which Entity the view shows, the order of its Properties, which Assertions
// name it, and which in-force statements belong to it. The service has already
// resolved the spans and decided what is in force. Nothing here does either.

import type {
  EventTimePoint,
  InForceStatement,
  StatementTime,
  StatementTimes,
  Story,
  UnresolvedComparison,
} from '../api/client'

export type StatementSpan = StatementTime['spans'][number]

export type StatementRow = {
  id: string
  spans: StatementSpan[]
  causedBy: string | null
}

/**
 * The Entity on screen.
 *
 * `?entity=` wins when it names an Entity. Otherwise an Entity in `?record=`
 * is used, or the Entity that owns a selected Property, or the first Entity.
 */
export function viewedEntityId(
  story: Story,
  entityParam: string | null,
  recordId: string | null,
): string | null {
  const entities = new Set(story.entities.map((entity) => entity.id))
  if (entityParam && entities.has(entityParam)) return entityParam
  if (recordId && entities.has(recordId)) return recordId
  const property = story.properties.find((item) => item.id === recordId)
  if (property && entities.has(property.entity_id)) return property.entity_id
  return story.entities[0]?.id ?? null
}

/** The address value of one stretch. The stretch before every bound is `before`. */
export function stretchKey(stretch: { start: string | null }): string {
  return stretch.start ?? 'before'
}

/** The stretch named by `?at=`, or null when the address names none of them. */
export function selectedStretch<T extends { start: string | null }>(
  stretches: readonly T[],
  at: string | null,
): T | null {
  if (!at) return null
  return stretches.find((stretch) => stretchKey(stretch) === at) ?? null
}

/** The stretch as a line: before a time, from one time until another, or onward. */
export function describeStretch(stretch: { start: string | null; end: string | null }): string {
  const start = stretch.start?.replace('T', ' ')
  const end = stretch.end?.replace('T', ' ')
  if (start && end) return `From ${start} until ${end}`
  if (start) return `From ${start}`
  if (end) return `Before ${end}`
  return 'At every time'
}

/**
 * The Entity's Properties, earliest resolved timestamp first.
 *
 * A Property with no resolved timestamp follows the ones that have one.
 * Equal timestamps keep the story's order.
 */
export function propertyRows(
  story: Story,
  times: StatementTimes,
  entityId: string,
): StatementRow[] {
  const spansOf = new Map(times.properties.map((item) => [item.id, item.spans]))
  return rowsFor(
    story.properties
      .map((property, index) => ({ property, index }))
      .filter(({ property }) => property.entity_id === entityId)
      .map(({ property, index }) => ({
        id: property.id,
        spans: spansOf.get(property.id) ?? [],
        causedBy: property.caused_by,
        index,
      })),
  )
}

/** The Assertions that name the Entity, in the order the story lists them. */
export function assertionRows(
  story: Story,
  times: StatementTimes,
  entityId: string,
): StatementRow[] {
  const spansOf = new Map(times.assertions.map((item) => [item.id, item.spans]))
  const named = story.assertions.filter((assertion) => assertion.entity_ids.includes(entityId))
  return named.map((assertion) => ({
    id: assertion.id,
    spans: spansOf.get(assertion.id) ?? [],
    causedBy: assertion.caused_by,
  }))
}

/**
 * The in-force statements that belong to the Entity, in the service's order.
 *
 * A Property belongs when the Entity owns it. An Assertion belongs when it
 * names the Entity.
 */
export function inForceForEntity(
  story: Story,
  statements: readonly InForceStatement[],
  entityId: string,
): { properties: InForceStatement[]; assertions: InForceStatement[] } {
  const properties = new Set(
    story.properties.filter((property) => property.entity_id === entityId).map((property) => property.id),
  )
  const assertions = new Set(
    story.assertions
      .filter((assertion) => assertion.entity_ids.includes(entityId))
      .map((assertion) => assertion.id),
  )
  return {
    properties: statements.filter(
      (statement) => statement.kind === 'property' && properties.has(statement.id),
    ),
    assertions: statements.filter(
      (statement) => statement.kind === 'assertion' && assertions.has(statement.id),
    ),
  }
}

/** One span as the service read it. */
export function describeResolvedSpan(
  span: StatementSpan,
  labelOf: (recordId: string) => string,
): string {
  if (span.kind === 'at') {
    return `observed at ${describeResolvedPoint(span.at, labelOf)}`
  }
  const start = span.start ? describeResolvedPoint(span.start, labelOf) : null
  const end = span.end ? describeResolvedPoint(span.end, labelOf) : null
  let text = 'a period with neither bound recorded'
  if (start && end) text = `from ${start} to ${end}`
  else if (start) text = `from ${start}`
  else if (end) text = `until ${end}`
  if (span.ends_before_start) return `${text}. The range ends before it starts`
  return text
}

/** The query line above the in-force list. */
export function describeQuery(
  query: EventTimePoint,
  labelOf: (recordId: string) => string,
): string {
  if ('timestamp' in query.point) {
    const shown = query.timestamp ?? query.point.timestamp
    return `At ${shown.replace('T', ' ')}.`
  }
  const edge = query.edge === 'end' ? 'end' : 'start'
  const named = `the ${edge} of “${labelOf(query.point.event_id)}”`
  if (query.timestamp) return `At ${named} (${query.timestamp.replace('T', ' ')}).`
  return `At ${named}, which does not resolve: ${unresolvedWhy(query.unresolved, labelOf)}.`
}

/** One comparison the in-force reading could not make. */
export function describeComparison(
  mark: UnresolvedComparison,
  labelOf: (recordId: string) => string,
): string {
  const bound = mark.bound === 'end' ? 'end' : 'start'
  return `The ${bound} of span ${mark.span + 1} does not resolve: ${unresolvedWhy(mark.unresolved, labelOf)}.`
}

function rowsFor(owned: (StatementRow & { index: number })[]): StatementRow[] {
  const sorted = [...owned].sort((a, b) => {
    const aKey = earliest(a.spans)
    const bKey = earliest(b.spans)
    if (aKey === null && bKey === null) return a.index - b.index
    if (aKey === null) return 1
    if (bKey === null) return -1
    if (aKey !== bKey) return aKey < bKey ? -1 : 1
    return a.index - b.index
  })
  return sorted.map((row) => ({
    id: row.id,
    spans: row.spans,
    causedBy: row.causedBy,
  }))
}

function earliest(spans: readonly StatementSpan[]): string | null {
  let best: string | null = null
  for (const span of spans) {
    const points = span.kind === 'at' ? [span.at] : [span.start, span.end]
    for (const point of points) {
      if (point?.timestamp && (best === null || point.timestamp < best)) best = point.timestamp
    }
  }
  return best
}

function describeResolvedPoint(
  point: EventTimePoint,
  labelOf: (recordId: string) => string,
): string {
  if ('timestamp' in point.point) return point.point.timestamp.replace('T', ' ')
  const edge = point.edge === 'end' ? 'end' : 'start'
  const named = `the ${edge} of “${labelOf(point.point.event_id)}”`
  if (point.timestamp) return `${named} (${point.timestamp.replace('T', ' ')})`
  return `${named}, which does not resolve: ${unresolvedWhy(point.unresolved, labelOf)}`
}

function unresolvedWhy(
  reason: EventTimePoint['unresolved'],
  labelOf: (recordId: string) => string,
): string {
  if (!reason) return 'it has no time'
  const stopped = reason.event_ids[reason.event_ids.length - 1]
  const who = stopped ? `“${labelOf(stopped)}”` : 'the Event it names'
  const because =
    reason.code === 'no_time'
      ? `${who} has no time`
      : reason.code === 'several_spans'
        ? `${who} has several spans`
        : `${who} has no recorded start or end`
  if (reason.event_ids.length > 1) {
    const chain = reason.event_ids.map((id) => `“${labelOf(id)}”`).join(', then ')
    return `it follows ${chain}, and stops because ${because}`
  }
  return because
}
