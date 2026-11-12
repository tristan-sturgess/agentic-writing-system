// A `when` list as text. This says what each span stores. It does not decide
// what is in force at a point; that is the in-force view, built in a later step.

import type { Span, TimePoint } from '../api/client'

export function describePoint(
  point: TimePoint,
  labelOf: (recordId: string) => string,
): string {
  if ('timestamp' in point) {
    // `1921-06-14T03:15` reads better as `1921-06-14 03:15`. The value is
    // story time as written, so it is not converted to the reader's time zone.
    return point.timestamp.replace('T', ' ')
  }
  const title = `“${labelOf(point.event_id)}”`
  // The records view shows the edge that was stored. It does not decide which
  // end a missing edge means; that reading belongs to the timeline.
  if (point.edge === 'start') return `the start of ${title}`
  if (point.edge === 'end') return `the end of ${title}`
  return title
}

export function describeSpan(
  span: Span,
  labelOf: (recordId: string) => string,
): string {
  if (span.kind === 'at') {
    return `at ${describePoint(span.at, labelOf)}`
  }
  const start = span.start ? describePoint(span.start, labelOf) : null
  const end = span.end ? describePoint(span.end, labelOf) : null
  if (start && end) return `from ${start} to ${end}`
  if (start) return `from ${start}`
  if (end) return `until ${end}`
  return 'a period with neither bound recorded'
}
