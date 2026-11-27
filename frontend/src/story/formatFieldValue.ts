// One field's stored value as text. A span uses the same wording as a `when` list.

import type { Span, TimePoint } from '../api/client'
import { labelOf, type RecordIndex } from './records'
import { describeSpan } from './when'

/** The text a field value is shown as, in a conflict and in a commit's diff. */
export function formatFieldValue(value: unknown, index: RecordIndex): string {
  if (value == null) return 'none'
  if (typeof value === 'string') {
    if (value === '') return 'empty'
    return index.has(value) ? labelOf(index, value) : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (isSpan(value)) return describeSpan(value, (id) => labelOf(index, id))
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none'
    if (value.every((item) => typeof item === 'string')) {
      return value.map((item) => (index.has(item) ? labelOf(index, item) : item)).join(', ')
    }
    if (value.every(isSpan)) {
      return value.map((span) => describeSpan(span, (id) => labelOf(index, id))).join('; ')
    }
  }
  return JSON.stringify(value)
}

function isTimePoint(value: unknown): value is TimePoint {
  if (typeof value !== 'object' || value === null) return false
  if ('timestamp' in value && typeof value.timestamp === 'string') return true
  return 'event_id' in value && typeof value.event_id === 'string'
}

function isSpan(value: unknown): value is Span {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return false
  if (value.kind === 'at') return 'at' in value && isTimePoint(value.at)
  if (value.kind === 'range') {
    const start = 'start' in value ? value.start : null
    const end = 'end' in value ? value.end : null
    return (start == null || isTimePoint(start)) && (end == null || isTimePoint(end))
  }
  return false
}
