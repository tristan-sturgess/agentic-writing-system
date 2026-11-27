import { expect, test } from 'vitest'

import { formatFieldValue } from './formatFieldValue'
import type { RecordIndex } from './records'

const index: RecordIndex = new Map([
  ['entity_mara', { kind: 'entity', label: 'Mara' }],
  ['event_arrival', { kind: 'event', label: 'Arrival' }],
])

test('a record id is its label, and an empty value says so', () => {
  expect(formatFieldValue('entity_mara', index)).toBe('Mara')
  expect(formatFieldValue(['entity_mara', 'entity_gone'], index)).toBe('Mara, entity_gone')
  expect(formatFieldValue(null, index)).toBe('none')
  expect(formatFieldValue('', index)).toBe('empty')
  expect(formatFieldValue([], index)).toBe('none')
})

test('a when list is written as span text', () => {
  expect(
    formatFieldValue(
      [{ kind: 'at', at: { event_id: 'event_arrival', edge: 'end' } }],
      index,
    ),
  ).toBe('at the end of “Arrival”')
  expect(
    formatFieldValue(
      { kind: 'range', start: { timestamp: '1921-06-14T03:15' }, end: null },
      index,
    ),
  ).toBe('from 1921-06-14 03:15')
})
