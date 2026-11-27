// The form's picture of a `when` list, and the spans the commit stores.
// A draft can be half filled. The span model cannot, so the conversion is
// where an incomplete point becomes an error instead of a write.

import type { Span, TimePoint } from '../api/client'

export type EdgeValue = '' | 'start' | 'end'

export type PointDraft = {
  /** `none` is a range bound the span does not record. */
  source: 'none' | 'timestamp' | 'event'
  timestamp: string
  eventId: string
  /** Empty leaves the edge out. On a range bound, the place of the point supplies it. */
  edge: EdgeValue
}

/**
 * One span being edited. `at`, `start`, and `end` are all kept so switching
 * between a moment and a period does not throw away what was typed.
 */
export type SpanDraft = {
  key: string
  kind: 'at' | 'range'
  at: PointDraft
  start: PointDraft
  end: PointDraft
}

export function emptyPoint(): PointDraft {
  return { source: 'none', timestamp: '', eventId: '', edge: '' }
}

export function timestampPoint(timestamp = ''): PointDraft {
  return { source: 'timestamp', timestamp, eventId: '', edge: '' }
}

export function eventPoint(eventId = '', edge: EdgeValue = ''): PointDraft {
  return { source: 'event', timestamp: '', eventId, edge }
}

export function emptyAt(key: string): SpanDraft {
  return { key, kind: 'at', at: timestampPoint(), start: emptyPoint(), end: emptyPoint() }
}

export function emptyRange(key: string): SpanDraft {
  return {
    key,
    kind: 'range',
    at: timestampPoint(),
    start: timestampPoint(),
    end: timestampPoint(),
  }
}

/**
 * The end a range bound means when `edge` is left empty. The start of a range
 * means the Event's end. The end of a range means the Event's start.
 */
export function impliedEdge(bound: 'start' | 'end'): 'start' | 'end' {
  return bound === 'start' ? 'end' : 'start'
}

function pointDraft(point: TimePoint | null | undefined): PointDraft {
  if (point == null) return emptyPoint()
  if ('timestamp' in point) return timestampPoint(point.timestamp)
  return eventPoint(point.event_id, point.edge === 'start' || point.edge === 'end' ? point.edge : '')
}

export function spanDraft(span: Span, key: string): SpanDraft {
  if (span.kind === 'at') {
    return { key, kind: 'at', at: pointDraft(span.at), start: emptyPoint(), end: emptyPoint() }
  }
  return {
    key,
    kind: 'range',
    at: timestampPoint(),
    start: pointDraft(span.start),
    end: pointDraft(span.end),
  }
}

/** One draft per stored span. Keys are stable for a given list. */
export function spanDrafts(spans: readonly Span[]): SpanDraft[] {
  return spans.map((span, index) => spanDraft(span, `loaded-${index}`))
}

export type SpanListResult = { spans: Span[] } | { error: string }

function pointFromDraft(
  draft: PointDraft,
  where: string,
): { point: TimePoint } | { point: null } | { error: string } {
  if (draft.source === 'none') return { point: null }
  if (draft.source === 'timestamp') {
    const timestamp = draft.timestamp.trim()
    if (timestamp === '') return { error: `${where} needs a timestamp.` }
    return { point: { timestamp } }
  }
  const eventId = draft.eventId.trim()
  if (eventId === '') return { error: `${where} needs an Event.` }
  if (draft.edge === '') return { point: { event_id: eventId } }
  return { point: { event_id: eventId, edge: draft.edge } }
}

/** The spans to store, or the first reason the drafts are not spans yet. */
export function spansFromDrafts(drafts: readonly SpanDraft[]): SpanListResult {
  const spans: Span[] = []
  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index]
    const label = `Span ${index + 1}`
    if (!draft) return { error: `${label} is missing.` }
    if (draft.kind === 'at') {
      const at = pointFromDraft(draft.at, label)
      if ('error' in at) return at
      if (at.point == null) return { error: `${label} needs a time.` }
      if ('event_id' in at.point && draft.at.edge === '') {
        return { error: `${label} names an Event, so its edge must be start or end.` }
      }
      spans.push({ kind: 'at', at: at.point })
      continue
    }
    const start = pointFromDraft(draft.start, `${label} start`)
    if ('error' in start) return start
    const end = pointFromDraft(draft.end, `${label} end`)
    if ('error' in end) return end
    const span: Span = { kind: 'range' }
    if (start.point) span.start = start.point
    if (end.point) span.end = end.point
    spans.push(span)
  }
  return { spans }
}
