import { expect, test } from 'vitest'

import type { EventTimePoint, EventTimes, Span, Story, StoryEvent } from '../api/client'
import {
  eventsLinkedByTime,
  inProgress,
  layOutTimeline,
  type Mark,
  type TimelineLayout,
} from './layout'

function story(events: StoryEvent[], extra: Partial<Story> = {}): Story {
  return {
    id: 'story_1',
    schema_version: 1,
    revision: 1,
    created_at: '2026-11-12T00:00:00Z',
    updated_at: '2026-11-12T00:00:00Z',
    title: 'A story',
    description: '',
    premise: '',
    tone: '',
    themes: '',
    writing_style: '',
    unit_ids: [],
    entities: [],
    properties: [],
    assertions: [],
    events,
    units: [],
    arcs: [],
    ...extra,
  }
}

function event(id: string, when: Span[] = []): StoryEvent {
  return { id, title: id, description: '', entity_ids: [], when, revision: 1 }
}

/** The service's normalised form. A date alone is the start of that day. */
function normalize(written: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(written)) return `${written}T00:00:00`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(written)) return `${written}:00`
  return written
}

function writtenPoint(written: string): EventTimePoint {
  return {
    point: { timestamp: written },
    edge: null,
    timestamp: normalize(written),
    unresolved: null,
  }
}

function derivedPoint(
  eventId: string,
  edge: 'start' | 'end',
  timestamp: string | null,
  unresolved: EventTimePoint['unresolved'] = null,
): EventTimePoint {
  return {
    point: { event_id: eventId, edge },
    edge,
    timestamp,
    unresolved,
  }
}

function timesOf(rows: { id: string; spans: EventTimes['events'][number]['spans'] }[]): EventTimes {
  return { events: rows }
}

function layoutOf(
  rows: { id: string; when?: Span[]; spans: EventTimes['events'][number]['spans'] }[],
): TimelineLayout {
  return layOutTimeline(
    story(rows.map((row) => event(row.id, row.when ?? []))),
    timesOf(rows.map((row) => ({ id: row.id, spans: row.spans }))),
  )
}

function kinds(marks: Mark[]): string[] {
  return marks.map((mark) => mark.kind)
}

test('one moment is a point, labelled with the timestamp as it was written', () => {
  const layout = layoutOf([
    { id: 'event_oath', spans: [{ kind: 'at', at: writtenPoint('1000-01-01') }] },
  ])
  expect(layout.moments).toEqual([{ timestamp: '1000-01-01T00:00:00', label: '1000-01-01' }])
  expect(layout.stretches).toEqual([])
  expect(layout.placed).toEqual([
    {
      eventId: 'event_oath',
      lane: 0,
      titleAt: '1000-01-01T00:00:00',
      marks: [
        {
          kind: 'point',
          spanIndex: 0,
          at: {
            timestamp: '1000-01-01T00:00:00',
            source: 'written',
            written: '1000-01-01',
            edge: null,
          },
        },
      ],
    },
  ])
  expect(layout.timeUnspecified).toEqual([])
  expect(layout.notResolved).toEqual([])
  expect(layout.endsBeforeStart).toEqual([])
})

test('several separate moments are points, and nothing is drawn between them', () => {
  const layout = layoutOf([
    {
      id: 'event_knocks',
      spans: [
        { kind: 'at', at: writtenPoint('1012-11-03T22:10') },
        { kind: 'at', at: writtenPoint('1012-11-03T22:12') },
        { kind: 'at', at: writtenPoint('1012-11-03T22:15') },
      ],
    },
  ])
  expect(layout.moments.map((moment) => moment.label)).toEqual([
    '1012-11-03 22:10',
    '1012-11-03 22:12',
    '1012-11-03 22:15',
  ])
  expect(kinds(layout.placed[0].marks)).toEqual(['point', 'point', 'point'])
  expect(layout.placed[0].titleAt).toBe('1012-11-03T22:10:00')
})

test('a period is a bar from its start to its end, and the stretch says how long that is', () => {
  const days = layoutOf([
    {
      id: 'event_watch',
      spans: [
        {
          kind: 'range',
          start: writtenPoint('1921-06-10'),
          end: writtenPoint('1921-06-13'),
          ends_before_start: false,
        },
      ],
    },
  ])
  expect(kinds(days.placed[0].marks)).toEqual(['bar'])
  expect(days.stretches.map((stretch) => stretch.label)).toEqual(['3 days'])

  const minutes = layoutOf([
    {
      id: 'event_toast',
      spans: [
        {
          kind: 'range',
          start: writtenPoint('1012-11-03T21:00'),
          end: writtenPoint('1012-11-03T21:45'),
          ends_before_start: false,
        },
      ],
    },
  ])
  expect(minutes.stretches.map((stretch) => stretch.label)).toEqual(['45 minutes'])
})

test('a period with one bound unknown is a short open bar on the known bound', () => {
  const layout = layoutOf([
    {
      id: 'event_snow',
      spans: [
        { kind: 'range', start: writtenPoint('1012-11-03T17:00'), end: null, ends_before_start: false },
      ],
    },
    {
      id: 'event_grudge',
      spans: [
        { kind: 'range', start: null, end: writtenPoint('0999-06-01'), ends_before_start: false },
      ],
    },
    {
      id: 'event_later',
      spans: [{ kind: 'at', at: writtenPoint('1012-11-03T18:00') }],
    },
  ])
  expect(layout.placed.map((event) => [event.eventId, event.marks[0].kind])).toEqual([
    ['event_snow', 'open'],
    ['event_grudge', 'open'],
    ['event_later', 'point'],
  ])
  const snow = layout.placed[0].marks[0]
  const grudge = layout.placed[1].marks[0]
  expect(snow).toMatchObject({ toward: 'after', at: { timestamp: '1012-11-03T17:00:00' } })
  expect(grudge).toMatchObject({ toward: 'before', at: { timestamp: '0999-06-01T00:00:00' } })
  // The open end does not reach the next moment, so the later point can share the lane.
  expect(layout.placed.find((event) => event.eventId === 'event_snow')?.lane).toBe(
    layout.placed.find((event) => event.eventId === 'event_later')?.lane,
  )
})

test('a period with neither bound is not placed, as time unspecified', () => {
  const layout = layoutOf([
    { id: 'event_rumor', spans: [{ kind: 'range', start: null, end: null, ends_before_start: false }] },
  ])
  expect(layout.moments).toEqual([])
  expect(layout.placed).toEqual([])
  expect(layout.timeUnspecified).toEqual([{ eventId: 'event_rumor', spanIndex: 0, reasons: [] }])
})

test('an Event with no time is not placed, as time unspecified', () => {
  const layout = layoutOf([{ id: 'event_forgotten', spans: [] }])
  expect(layout.placed).toEqual([])
  expect(layout.timeUnspecified).toEqual([
    { eventId: 'event_forgotten', spanIndex: null, reasons: [] },
  ])
})

test('a time taken from another Event sits on that moment and is marked derived', () => {
  const layout = layoutOf([
    { id: 'event_oath', spans: [{ kind: 'at', at: writtenPoint('1000-01-01') }] },
    {
      id: 'event_crowning',
      spans: [{ kind: 'at', at: derivedPoint('event_oath', 'end', '1000-01-01T00:00:00') }],
    },
  ])
  expect(layout.moments).toEqual([{ timestamp: '1000-01-01T00:00:00', label: '1000-01-01' }])
  expect(layout.placed[1].marks[0]).toMatchObject({
    kind: 'point',
    at: {
      source: 'derived',
      eventId: 'event_oath',
      edge: 'end',
      timestamp: '1000-01-01T00:00:00',
    },
  })
  // The same moment overlaps, so the two Events are side by side.
  expect(layout.placed.map((event) => event.lane)).toEqual([0, 1])
})

test('a time that does not resolve is not placed, and the reason names where the chain stopped', () => {
  const layout = layoutOf([
    { id: 'event_forgotten', spans: [] },
    {
      id: 'event_lost',
      spans: [
        {
          kind: 'at',
          at: derivedPoint('event_forgotten', 'end', null, {
            code: 'no_time',
            event_ids: ['event_forgotten'],
          }),
        },
      ],
    },
    {
      id: 'event_between',
      spans: [
        {
          kind: 'at',
          at: derivedPoint('event_knocks', 'start', null, {
            code: 'several_spans',
            event_ids: ['event_knocks'],
          }),
        },
      ],
    },
    {
      id: 'event_since',
      spans: [
        {
          kind: 'at',
          at: derivedPoint('event_grudge', 'start', null, {
            code: 'bound_absent',
            event_ids: ['event_quiet', 'event_grudge'],
          }),
        },
      ],
    },
  ])
  expect(layout.placed.map((event) => event.eventId)).toEqual([])
  expect(layout.notResolved).toEqual([
    {
      eventId: 'event_lost',
      spanIndex: 0,
      reasons: [
        {
          place: 'at',
          code: 'no_time',
          eventIds: ['event_forgotten'],
          edge: 'end',
        },
      ],
    },
    {
      eventId: 'event_between',
      spanIndex: 0,
      reasons: [
        {
          place: 'at',
          code: 'several_spans',
          eventIds: ['event_knocks'],
          edge: 'start',
        },
      ],
    },
    {
      eventId: 'event_since',
      spanIndex: 0,
      reasons: [
        {
          place: 'at',
          code: 'bound_absent',
          eventIds: ['event_quiet', 'event_grudge'],
          edge: 'start',
        },
      ],
    },
  ])
})

test('a range that ends before it starts is not placed, in its own group', () => {
  const layout = layoutOf([
    {
      id: 'event_contradiction',
      spans: [
        {
          kind: 'range',
          start: derivedPoint('event_toast', 'start', '1012-11-03T21:00:00'),
          end: derivedPoint('event_oath', 'end', '1000-01-01T00:00:00'),
          ends_before_start: true,
        },
      ],
    },
  ])
  expect(layout.moments).toEqual([])
  expect(layout.placed).toEqual([])
  expect(layout.endsBeforeStart).toEqual([
    { eventId: 'event_contradiction', spanIndex: 0, reasons: [] },
  ])
})

test('events share a lane only when one is over before the other begins', () => {
  const layout = layoutOf([
    {
      id: 'event_feast',
      spans: [
        {
          kind: 'range',
          start: writtenPoint('1012-11-03T18:00'),
          end: writtenPoint('1012-11-03T23:00'),
          ends_before_start: false,
        },
      ],
    },
    {
      id: 'event_dance',
      spans: [
        {
          kind: 'range',
          start: writtenPoint('1012-11-03T19:00'),
          end: writtenPoint('1012-11-03T21:30'),
          ends_before_start: false,
        },
      ],
    },
    {
      id: 'event_dawn',
      spans: [{ kind: 'at', at: writtenPoint('1012-11-04T01:00') }],
    },
  ])
  const lane = (id: string) => layout.placed.find((event) => event.eventId === id)?.lane
  expect(lane('event_feast')).toBe(0)
  expect(lane('event_dance')).toBe(1)
  // The dawn is after the feast ends, so it can use the feast's lane.
  expect(lane('event_dawn')).toBe(0)
  expect(layout.laneCount).toBe(2)
})

test('stretch lengths count calendar time, including a year below 100 and a non-leap February', () => {
  const layout = layoutOf([
    { id: 'event_a', spans: [{ kind: 'at', at: writtenPoint('0004-02-28') }] },
    { id: 'event_b', spans: [{ kind: 'at', at: writtenPoint('0004-03-01') }] },
    { id: 'event_c', spans: [{ kind: 'at', at: writtenPoint('0099-06-01') }] },
    { id: 'event_d', spans: [{ kind: 'at', at: writtenPoint('0100-01-01') }] },
    { id: 'event_e', spans: [{ kind: 'at', at: writtenPoint('0100-02-28') }] },
    { id: 'event_f', spans: [{ kind: 'at', at: writtenPoint('0100-03-01') }] },
    { id: 'event_g', spans: [{ kind: 'at', at: writtenPoint('1000-01-01') }] },
    { id: 'event_h', spans: [{ kind: 'at', at: writtenPoint('1010-06-01') }] },
  ])
  expect(layout.stretches.map((stretch) => stretch.label)).toEqual([
    '2 days',
    '95 years, 3 months',
    '7 months',
    '1 month, 27 days',
    '1 day',
    '899 years, 10 months',
    '10 years, 5 months',
  ])
})

test('an Event with one span placed and one that cannot be is drawn and listed', () => {
  const layout = layoutOf([
    {
      id: 'event_mixed',
      spans: [
        { kind: 'at', at: writtenPoint('1921-06-10') },
        {
          kind: 'at',
          at: derivedPoint('event_forgotten', 'start', null, {
            code: 'no_time',
            event_ids: ['event_forgotten'],
          }),
        },
      ],
    },
  ])
  expect(layout.placed.map((event) => event.eventId)).toEqual(['event_mixed'])
  expect(kinds(layout.placed[0].marks)).toEqual(['point'])
  expect(layout.notResolved.map((entry) => entry.spanIndex)).toEqual([1])
})

test('a moment lists what is in progress there, and an open bar is listed apart', () => {
  const layout = layoutOf([
    {
      id: 'event_feast',
      spans: [
        {
          kind: 'range',
          start: writtenPoint('1012-11-03T18:00'),
          end: writtenPoint('1012-11-03T23:00'),
          ends_before_start: false,
        },
      ],
    },
    { id: 'event_toast', spans: [{ kind: 'at', at: writtenPoint('1012-11-03T21:00') }] },
    {
      id: 'event_snow',
      spans: [
        { kind: 'range', start: writtenPoint('1012-11-03T17:00'), end: null, ends_before_start: false },
      ],
    },
    {
      id: 'event_grudge',
      spans: [
        { kind: 'range', start: null, end: writtenPoint('1012-11-03T22:00'), ends_before_start: false },
      ],
    },
  ])
  const atToast = inProgress(layout, { kind: 'moment', timestamp: '1012-11-03T21:00:00' })
  expect(atToast.happening).toEqual(['event_feast', 'event_toast'])
  expect(atToast.begunNoEnd).toEqual(['event_snow'])
  expect(atToast.endedNoStart).toEqual(['event_grudge'])

  const across = inProgress(layout, {
    kind: 'stretch',
    from: '1012-11-03T18:00:00',
    to: '1012-11-03T21:00:00',
  })
  expect(across.happening).toEqual(['event_feast'])
  expect(across.begunNoEnd).toEqual(['event_snow'])
  expect(across.endedNoStart).toEqual(['event_grudge'])

  // A point on the later moment is not in progress across the stretch before it.
  const beforeToast = inProgress(layout, {
    kind: 'stretch',
    from: '1012-11-03T17:00:00',
    to: '1012-11-03T18:00:00',
  })
  expect(beforeToast.happening).toEqual([])
})

test('events linked by time follow the chain in both directions', () => {
  const linked = eventsLinkedByTime(
    story([
      event('event_oath', [{ kind: 'at', at: { timestamp: '1000-01-01' } }]),
      event('event_crowning', [{ kind: 'at', at: { event_id: 'event_oath', edge: 'end' } }]),
      event('event_decree', [{ kind: 'at', at: { event_id: 'event_crowning', edge: 'start' } }]),
      event('event_other', [{ kind: 'at', at: { timestamp: '1001-01-01' } }]),
    ]),
    'event_decree',
  )
  expect([...linked].sort()).toEqual(['event_crowning', 'event_decree', 'event_oath'])
})

test('a time link leaves out siblings and the other end of a different span', () => {
  const told = story([
    event('event_oath', [{ kind: 'at', at: { timestamp: '1000-01-01' } }]),
    event('event_crowning', [{ kind: 'at', at: { event_id: 'event_oath', edge: 'end' } }]),
    event('event_decree', [{ kind: 'at', at: { event_id: 'event_crowning', edge: 'start' } }]),
    event('event_reign', [
      { kind: 'range', start: { event_id: 'event_oath' }, end: { timestamp: '1010-06-01' } },
    ]),
    event('event_toast', [{ kind: 'at', at: { timestamp: '1012-11-03T21:00' } }]),
    event('event_contradiction', [
      {
        kind: 'range',
        start: { event_id: 'event_toast', edge: 'start' },
        end: { event_id: 'event_oath', edge: 'end' },
      },
    ]),
  ])
  expect([...eventsLinkedByTime(told, 'event_decree')].sort()).toEqual([
    'event_crowning',
    'event_decree',
    'event_oath',
  ])
  expect([...eventsLinkedByTime(told, 'event_oath')].sort()).toEqual([
    'event_contradiction',
    'event_crowning',
    'event_decree',
    'event_oath',
    'event_reign',
  ])
  expect([...eventsLinkedByTime(told, 'event_contradiction')].sort()).toEqual([
    'event_contradiction',
    'event_oath',
    'event_toast',
  ])
})
