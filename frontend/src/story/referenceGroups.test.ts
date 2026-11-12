import { expect, test } from 'vitest'

import { byKind, groupReferences, kindOfReferrer } from './referenceGroups'
import type { Reference } from './references'

const reignNamedBy: Reference[] = [
  { from: 'arc_the_old_claim', to: 'event_the_reign', field: 'event_ids' },
  { from: 'event_the_oath', to: 'event_the_reign', field: 'when' },
]

test('an Arc that names an Event is grouped as an Arc, not by the event_ids field', () => {
  const index = new Map([
    ['arc_the_old_claim', { kind: 'arc' as const, label: 'The old claim' }],
    ['event_the_oath', { kind: 'event' as const, label: 'The oath' }],
  ])
  const groups = byKind(
    groupReferences(reignNamedBy, (ref) => ref.from, (_ref, id) =>
      kindOfReferrer(index, 'story', id),
    ),
  )
  expect(groups).toEqual([
    { key: 'event', ids: ['event_the_oath'] },
    { key: 'arc', ids: ['arc_the_old_claim'] },
  ])
})

test('the same record naming through two fields is listed once', () => {
  const refs: Reference[] = [
    { from: 'assertion_1', to: 'event_1', field: 'event_ids' },
    { from: 'assertion_1', to: 'event_1', field: 'when' },
  ]
  expect(groupReferences(refs, (ref) => ref.from, () => 'assertion')).toEqual([
    { key: 'assertion', ids: ['assertion_1'] },
  ])
})

test('names stay grouped by the field that holds the id', () => {
  const refs: Reference[] = [
    { from: 'event_1', to: 'entity_maret', field: 'entity_ids' },
    { from: 'event_1', to: 'entity_harthall', field: 'entity_ids' },
    { from: 'event_1', to: 'event_oath', field: 'when' },
  ]
  expect(groupReferences(refs, (ref) => ref.to, (ref) => ref.field)).toEqual([
    { key: 'entity_ids', ids: ['entity_maret', 'entity_harthall'] },
    { key: 'when', ids: ['event_oath'] },
  ])
})
