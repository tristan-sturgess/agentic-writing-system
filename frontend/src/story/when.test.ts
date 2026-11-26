import { expect, test } from 'vitest'

import type { Span } from '../api/client'
import { describeSpan } from './when'

const titles: Record<string, string> = { event_arrival: 'Arrival' }
const labelOf = (recordId: string) => titles[recordId] ?? recordId

test.each<[string, Span, string]>([
  ['a date', { kind: 'at', at: { timestamp: '1921-06-10' } }, 'at 1921-06-10'],
  [
    'a date-time, as written and not shifted to a time zone',
    { kind: 'at', at: { timestamp: '1921-06-14T03:15:22' } },
    'at 1921-06-14 03:15:22',
  ],
  [
    'an Event, by its title, when no edge is stored',
    { kind: 'at', at: { event_id: 'event_arrival' } },
    'at “Arrival”',
  ],
  [
    'an Event whose stored edge is null',
    { kind: 'at', at: { event_id: 'event_arrival', edge: null } },
    'at “Arrival”',
  ],
  [
    'the start of an Event',
    { kind: 'at', at: { event_id: 'event_arrival', edge: 'start' } },
    'at the start of “Arrival”',
  ],
  [
    'the end of an Event',
    { kind: 'at', at: { event_id: 'event_arrival', edge: 'end' } },
    'at the end of “Arrival”',
  ],
  [
    'a range with both bounds',
    {
      kind: 'range',
      start: { event_id: 'event_arrival' },
      end: { timestamp: '1921-06-15' },
    },
    'from “Arrival” to 1921-06-15',
  ],
  [
    'a range whose bounds store an edge',
    {
      kind: 'range',
      start: { event_id: 'event_arrival', edge: 'end' },
      end: { event_id: 'event_arrival', edge: 'start' },
    },
    'from the end of “Arrival” to the start of “Arrival”',
  ],
  [
    'a range with no end, sent as null',
    { kind: 'range', start: { timestamp: '1921-03-10' }, end: null },
    'from 1921-03-10',
  ],
  [
    'a range with no start, left out',
    { kind: 'range', end: { timestamp: '1921-09-30' } },
    'until 1921-09-30',
  ],
  ['a range with neither bound', { kind: 'range' }, 'a period with neither bound recorded'],
])('describes %s', (_case, span, text) => {
  expect(describeSpan(span, labelOf)).toBe(text)
})
