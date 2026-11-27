import { expect, test } from 'vitest'

import type { Span } from '../api/client'
import { sameValue } from './writes'
import {
  emptyAt,
  emptyRange,
  eventPoint,
  impliedEdge,
  spanDrafts,
  spansFromDrafts,
  timestampPoint,
} from './spanForm'

const stored: Span[] = [
  {
    kind: 'range',
    start: { event_id: 'event_arrival', edge: null },
    end: { event_id: 'event_the_letter', edge: 'end' },
  },
  { kind: 'at', at: { timestamp: '1847-03-02' } },
  { kind: 'at', at: { event_id: 'event_market', edge: 'start' } },
  { kind: 'range' },
]

test('a draft rebuilt from stored spans is the same when list', () => {
  const converted = spansFromDrafts(spanDrafts(stored))
  expect('spans' in converted).toBe(true)
  if (!('spans' in converted)) return
  expect(sameValue(converted.spans, stored)).toBe(true)
})

test('an at that names an Event and gives no edge is not a span', () => {
  const draft = emptyAt('one')
  draft.at = eventPoint('event_arrival', '')
  expect(spansFromDrafts([draft])).toEqual({
    error: 'Span 1 names an Event, so its edge must be start or end.',
  })
})

test('a blank timestamp and a missing Event are not time points', () => {
  const blank = emptyAt('one')
  blank.at = timestampPoint('   ')
  expect(spansFromDrafts([blank])).toEqual({ error: 'Span 1 needs a timestamp.' })

  const missing = emptyRange('two')
  missing.start = eventPoint('', '')
  expect(spansFromDrafts([missing])).toEqual({ error: 'Span 1 start needs an Event.' })
})

test('a range bound with no edge means the end its place implies', () => {
  expect(impliedEdge('start')).toBe('end')
  expect(impliedEdge('end')).toBe('start')
})

test('an empty edge on a range bound is left out of the span', () => {
  const draft = emptyRange('one')
  draft.start = eventPoint('event_arrival', '')
  draft.end = eventPoint('event_the_letter', 'start')
  const converted = spansFromDrafts([draft])
  expect(converted).toEqual({
    spans: [
      {
        kind: 'range',
        start: { event_id: 'event_arrival' },
        end: { event_id: 'event_the_letter', edge: 'start' },
      },
    ],
  })
})
