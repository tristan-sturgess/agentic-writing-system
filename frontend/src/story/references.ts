// The references between records, from "How the records connect" in the Story
// Bible doc. The detail panel lists them, and the graph draws the same list
// as its edges.

import type { Span, Story } from '../api/client'

export type Reference = {
  from: string
  to: string
  /** The stored field the id sits in, such as `entity_ids` or `when`. */
  field: string
}

/**
 * Every reference in the story, in document order.
 *
 * A field that names the same record twice, as two spans can, is one
 * reference. The first occurrence wins, so the list is stable.
 */
export function references(story: Story): Reference[] {
  const found: Reference[] = []
  const seen = new Set<string>()
  const add = (from: string, to: string, field: string) => {
    const key = `${from}\0${field}\0${to}`
    if (seen.has(key)) return
    seen.add(key)
    found.push({ from, to, field })
  }

  for (const unitId of story.unit_ids) add(story.id, unitId, 'unit_ids')
  for (const property of story.properties) {
    add(property.id, property.entity_id, 'entity_id')
    if (property.caused_by) add(property.id, property.caused_by, 'caused_by')
    addSpans(add, property.id, property.when)
  }
  for (const assertion of story.assertions) {
    for (const id of assertion.entity_ids) add(assertion.id, id, 'entity_ids')
    for (const id of assertion.event_ids) add(assertion.id, id, 'event_ids')
    for (const id of assertion.arc_ids) add(assertion.id, id, 'arc_ids')
    if (assertion.caused_by) add(assertion.id, assertion.caused_by, 'caused_by')
    addSpans(add, assertion.id, assertion.when)
  }
  for (const event of story.events) {
    for (const id of event.entity_ids) add(event.id, id, 'entity_ids')
    addSpans(add, event.id, event.when)
  }
  for (const unit of story.units) {
    for (const id of unit.child_ids) add(unit.id, id, 'child_ids')
    for (const id of unit.subject_ids) add(unit.id, id, 'subject_ids')
  }
  for (const arc of story.arcs) {
    for (const id of arc.event_ids) add(arc.id, id, 'event_ids')
  }
  return found
}

function addSpans(
  add: (from: string, to: string, field: string) => void,
  from: string,
  spans: Span[],
) {
  for (const span of spans) {
    const points = span.kind === 'at' ? [span.at] : [span.start, span.end]
    for (const point of points) {
      if (point && 'event_id' in point) add(from, point.event_id, 'when')
    }
  }
}
