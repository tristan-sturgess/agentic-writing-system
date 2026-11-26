import { expect, test } from 'vitest'

import type {
  Assertion,
  Entity,
  EventTimePoint,
  InForceStatement,
  Property,
  StatementTimes,
  Story,
  UnresolvedComparison,
} from '../api/client'
import {
  assertionRows,
  describeComparison,
  describeQuery,
  describeResolvedSpan,
  describeStretch,
  inForceForEntity,
  selectedStretch,
  stretchKey,
  propertyRows,
  viewedEntityId,
  type StatementSpan,
} from './layout'

function story(extra: Partial<Story> = {}): Story {
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
    events: [],
    units: [],
    arcs: [],
    ...extra,
  }
}

function entity(id: string): Entity {
  return { id, name: id, notes: '', revision: 1 }
}

function property(
  id: string,
  entityId: string,
  extra: Partial<Property> = {},
): Property {
  return {
    id,
    entity_id: entityId,
    statement: id,
    when: [],
    caused_by: null,
    revision: 1,
    ...extra,
  }
}

function assertion(id: string, entityIds: string[], extra: Partial<Assertion> = {}): Assertion {
  return {
    id,
    entity_ids: entityIds,
    event_ids: [],
    arc_ids: [],
    statement: id,
    when: [],
    caused_by: null,
    revision: 1,
    ...extra,
  }
}

function timestamp(written: string, resolved = `${written.slice(0, 10)}T00:00:00`): EventTimePoint {
  return { point: { timestamp: written }, edge: null, timestamp: resolved, unresolved: null }
}

function derived(
  eventId: string,
  edge: 'start' | 'end',
  resolved: string | null,
  unresolved: EventTimePoint['unresolved'] = null,
): EventTimePoint {
  return { point: { event_id: eventId, edge }, edge, timestamp: resolved, unresolved }
}

function times(
  properties: [string, StatementSpan[]][],
  assertions: [string, StatementSpan[]][] = [],
): StatementTimes {
  return {
    properties: properties.map(([id, spans]) => ({ id, spans })),
    assertions: assertions.map(([id, spans]) => ({ id, spans })),
  }
}

const name = (id: string) => id

test('the entity in the address wins, then the selected record, then the first', () => {
  const mara = entity('entity_mara')
  const john = entity('entity_john')
  const owned = property('prop_mara', 'entity_mara')
  const base = story({ entities: [mara, john], properties: [owned] })

  expect(viewedEntityId(base, 'entity_john', 'entity_mara')).toBe('entity_john')
  expect(viewedEntityId(base, 'entity_missing', 'entity_john')).toBe('entity_john')
  expect(viewedEntityId(base, null, 'prop_mara')).toBe('entity_mara')
  expect(viewedEntityId(base, null, 'assertion_other')).toBe('entity_mara')
  expect(viewedEntityId(base, null, null)).toBe('entity_mara')
  expect(viewedEntityId(story(), null, null)).toBeNull()
})

test('properties are ordered by the earliest resolved timestamp', () => {
  const base = story({
    entities: [entity('entity_mara')],
    properties: [
      property('prop_late', 'entity_mara'),
      property('prop_early', 'entity_mara'),
      property('prop_same', 'entity_mara'),
      property('prop_none', 'entity_mara'),
      property('prop_other', 'entity_john'),
      property('prop_next', 'entity_mara', { caused_by: 'event_letter' }),
    ],
  })
  const reading = times([
    ['prop_late', [{ kind: 'range', start: timestamp('1847-06-01'), end: null, ends_before_start: false }]],
    ['prop_early', [{ kind: 'range', start: timestamp('1847-03-02'), end: null, ends_before_start: false }]],
    ['prop_same', [{ kind: 'at', at: timestamp('1847-03-02') }]],
    ['prop_none', []],
    ['prop_other', [{ kind: 'range', start: timestamp('1840-01-01'), end: null, ends_before_start: false }]],
    ['prop_next', [{ kind: 'range', start: timestamp('1847-03-12'), end: null, ends_before_start: false }]],
  ])

  const rows = propertyRows(base, reading, 'entity_mara')
  expect(rows.map((row) => row.id)).toEqual([
    'prop_early',
    'prop_same',
    'prop_next',
    'prop_late',
    'prop_none',
  ])
  expect(rows.find((row) => row.id === 'prop_next')).toMatchObject({
    causedBy: 'event_letter',
  })
})

test('assertions that name the entity stay in story order', () => {
  const base = story({
    entities: [entity('entity_mara')],
    assertions: [
      assertion('assertion_both', ['entity_mara', 'entity_john']),
      assertion('assertion_john', ['entity_john', 'entity_market']),
      assertion('assertion_later', ['entity_mara']),
    ],
  })
  const rows = assertionRows(base, times([], []), 'entity_mara')
  expect(rows.map((row) => row.id)).toEqual(['assertion_both', 'assertion_later'])
})

test('in force keeps this entity’s statements in the service’s order', () => {
  const base = story({
    entities: [entity('entity_mara'), entity('entity_john')],
    properties: [
      property('prop_mara', 'entity_mara'),
      property('prop_john', 'entity_john'),
    ],
    assertions: [
      assertion('assertion_mara', ['entity_mara', 'entity_john']),
      assertion('assertion_john', ['entity_john', 'entity_market']),
    ],
  })
  const statements: InForceStatement[] = [
    { id: 'prop_john', kind: 'property', unresolved: [] },
    { id: 'prop_mara', kind: 'property', unresolved: [] },
    { id: 'assertion_john', kind: 'assertion', unresolved: [] },
    { id: 'assertion_mara', kind: 'assertion', unresolved: [] },
  ]
  const held = inForceForEntity(base, statements, 'entity_mara')
  expect(held.properties.map((item) => item.id)).toEqual(['prop_mara'])
  expect(held.assertions.map((item) => item.id)).toEqual(['assertion_mara'])
})

test('a stretch in the address is its start, and the one before every bound is before', () => {
  const stretches = [
    { start: null, end: '1847-03-02T00:00:00' },
    { start: '1847-03-02T00:00:00', end: '1847-03-12T00:00:00' },
    { start: '1847-03-12T00:00:00', end: null },
  ]
  expect(stretchKey(stretches[0])).toBe('before')
  expect(selectedStretch(stretches, null)).toBeNull()
  expect(selectedStretch(stretches, 'before')).toBe(stretches[0])
  expect(selectedStretch(stretches, '1847-03-12T00:00:00')).toBe(stretches[2])
  expect(selectedStretch(stretches, '1847-03-11')).toBeNull()
  expect(describeStretch(stretches[0])).toBe('Before 1847-03-02 00:00:00')
  expect(describeStretch(stretches[1])).toBe('From 1847-03-02 00:00:00 until 1847-03-12 00:00:00')
  expect(describeStretch(stretches[2])).toBe('From 1847-03-12 00:00:00')
  expect(describeStretch({ start: null, end: null })).toBe('At every time')
})

test('a span is described from the resolved reading', () => {
  const at: StatementSpan = { kind: 'at', at: timestamp('1847-03-04T09:00', '1847-03-04T09:00:00') }
  expect(describeResolvedSpan(at, name)).toBe('observed at 1847-03-04 09:00')

  const open: StatementSpan = {
    kind: 'range',
    start: derived('event_the_letter', 'end', '1847-03-12T00:00:00'),
    end: null,
    ends_before_start: false,
  }
  expect(describeResolvedSpan(open, name)).toBe(
    'from the end of “event_the_letter” (1847-03-12 00:00:00)',
  )

  const unresolved: StatementSpan = {
    kind: 'range',
    start: derived('event_the_rumour', 'end', null, {
      code: 'no_time',
      event_ids: ['event_the_rumour'],
    }),
    end: null,
    ends_before_start: false,
  }
  expect(describeResolvedSpan(unresolved, name)).toBe(
    'from the end of “event_the_rumour”, which does not resolve: “event_the_rumour” has no time',
  )

  const backwards: StatementSpan = {
    kind: 'range',
    start: timestamp('1847-06-01'),
    end: timestamp('1847-03-02'),
    ends_before_start: true,
  }
  expect(describeResolvedSpan(backwards, name)).toBe(
    'from 1847-06-01 to 1847-03-02. The range ends before it starts',
  )

  const neither: StatementSpan = {
    kind: 'range',
    start: null,
    end: null,
    ends_before_start: false,
  }
  expect(describeResolvedSpan(neither, name)).toBe('a period with neither bound recorded')
})

test('the query line names the time the service read', () => {
  expect(describeQuery(timestamp('1847-03-02'), name)).toBe('At 1847-03-02 00:00:00.')
  expect(describeQuery(derived('event_the_letter', 'end', '1847-03-12T00:00:00'), name)).toBe(
    'At the end of “event_the_letter” (1847-03-12 00:00:00).',
  )
  expect(
    describeQuery(
      derived('event_the_rumour', 'start', null, { code: 'no_time', event_ids: ['event_the_rumour'] }),
      name,
    ),
  ).toBe('At the start of “event_the_rumour”, which does not resolve: “event_the_rumour” has no time.')
})

test('an unresolved comparison names the span, the bound, and the reason', () => {
  const mark: UnresolvedComparison = {
    span: 0,
    bound: 'start',
    unresolved: { code: 'several_spans', event_ids: ['event_a', 'event_b'] },
  }
  expect(describeComparison(mark, name)).toBe(
    'The start of span 1 does not resolve: it follows “event_a”, then “event_b”, and stops because “event_b” has several spans.',
  )
})
