import { expect, test } from 'vitest'

import type { Committed, ConflictRowView, Entity, Problem, Property } from '../api/client'
import {
  conflictRowIsGone,
  conflictRowLabel,
  CREATED_REF,
  createdId,
  editedRecordGone,
  entityCreate,
  recordUpdate,
  fieldProblems,
  recordDelete,
  recordGone,
  sameValue,
  writesWithCurrentRevisions,
} from './writes'

const mara: Entity = {
  id: 'entity_mara',
  name: 'Mara',
  notes: 'Kept',
  revision: 3,
}

function problem(overrides: Partial<Problem> & Pick<Problem, 'message'>): Problem {
  return {
    code: 'blank_primary_text',
    ids: [],
    legal_ids: [],
    referring: [],
    ...overrides,
  }
}

test('an update names only the fields that changed, and the revision the panel loaded', () => {
  expect(recordUpdate('entity', mara, { name: 'Mara Voss', notes: 'Kept' })).toEqual({
    op: 'update',
    kind: 'entity',
    id: 'entity_mara',
    revision: 3,
    fields: { name: 'Mara Voss' },
  })
  expect(recordUpdate('entity', mara, { name: 'Mara', notes: 'A new note' })).toEqual({
    op: 'update',
    kind: 'entity',
    id: 'entity_mara',
    revision: 3,
    fields: { notes: 'A new note' },
  })
  const both = recordUpdate('entity', mara, { name: 'Mara Voss', notes: 'A new note' })
  expect(both && both.op === 'update' && both.kind === 'entity' ? both.fields : null).toEqual({
    name: 'Mara Voss',
    notes: 'A new note',
  })
})

test('an update that changes nothing is not sent', () => {
  expect(recordUpdate('entity', mara, { name: 'Mara', notes: 'Kept' })).toBeNull()
})

const distrustful: Property = {
  id: 'prop_mara_distrustful',
  entity_id: 'entity_mara',
  statement: 'Mara is distrustful.',
  when: [
    {
      kind: 'range',
      start: { event_id: 'event_arrival', edge: null },
      end: { event_id: 'event_the_letter', edge: 'end' },
    },
    { kind: 'at', at: { timestamp: '1847-03-02' } },
  ],
  caused_by: null,
  revision: 5,
}

test('a when list rebuilt by a form with the same spans is not a change', () => {
  // A form builds new objects, leaves out an edge it does not set, and may
  // write the keys in another order. None of that changes the record.
  const rebuilt = [
    {
      kind: 'range' as const,
      end: { edge: 'end' as const, event_id: 'event_the_letter' },
      start: { event_id: 'event_arrival' },
    },
    { kind: 'at' as const, at: { timestamp: '1847-03-02' } },
  ]
  expect(recordUpdate('property', distrustful, { when: rebuilt, caused_by: null })).toBeNull()
})

test('a when list with a changed edge or a new order is sent whole', () => {
  const edged = structuredClone(distrustful.when)
  edged[0] = {
    kind: 'range',
    start: { event_id: 'event_arrival', edge: 'start' },
    end: { event_id: 'event_the_letter', edge: 'end' },
  }
  expect(recordUpdate('property', distrustful, { when: edged })).toEqual({
    op: 'update',
    kind: 'property',
    id: 'prop_mara_distrustful',
    revision: 5,
    fields: { when: edged },
  })
  const reordered = [distrustful.when[1], distrustful.when[0]]
  const update = recordUpdate('property', distrustful, { when: reordered })
  expect(update && update.op === 'update' ? update.fields : null).toEqual({ when: reordered })
})

test('values compare by their data', () => {
  expect(sameValue(['a', 'b'], ['a', 'b'])).toBe(true)
  expect(sameValue(['a', 'b'], ['b', 'a'])).toBe(false)
  expect(sameValue(null, undefined)).toBe(true)
  expect(sameValue('', null)).toBe(false)
  expect(sameValue({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  expect(sameValue([], {})).toBe(false)
})

test('a create carries the name, the notes, and its ref, and a delete carries the revision', () => {
  expect(entityCreate({ name: 'John', notes: '' })).toEqual({
    op: 'create',
    kind: 'entity',
    ref: CREATED_REF,
    fields: { name: 'John', notes: '' },
  })
  expect(recordDelete(mara)).toEqual({ op: 'delete', id: 'entity_mara', revision: 3 })
})

test('the created record is found by its ref, not by its place in the response', () => {
  const committed: Committed = {
    commit_id: 'commit_1',
    story_revision: null,
    revisions: {},
    deleted: [],
    created: [
      { kind: 'entity', id: 'entity_john', ref: 'owner' },
      { kind: 'property', id: 'prop_john_is_tall', ref: CREATED_REF },
    ],
  }
  expect(createdId(committed, CREATED_REF)).toBe('prop_john_is_tall')
  expect(createdId(committed, 'missing')).toBeNull()
})

test('a refusal problem is matched to the field it names, with its legal ids', () => {
  const problems = [
    problem({ message: 'entity_mara has a blank name.', field: 'name' }),
    problem({
      code: 'unknown_id',
      message: 'No such record.',
      field: 'caused_by',
      legal_ids: ['event_arrival', 'event_departure'],
    }),
    problem({
      code: 'delete_still_named',
      message: 'entity_mara cannot be deleted while other records name it.',
      referring: ['event_arrival'],
    }),
    problem({ message: 'The name is still blank.', field: 'name' }),
  ]
  expect(fieldProblems(problems)).toEqual([
    {
      field: 'name',
      message: 'entity_mara has a blank name. The name is still blank.',
    },
    {
      field: 'caused_by',
      message: 'No such record. Legal ids: event_arrival, event_departure.',
    },
  ])
})

test('a conflict keeps a create as it is and moves an update onto the current revision', () => {
  const update = recordUpdate('entity', mara, { name: 'Mara Voss', notes: 'Kept' })
  const create = entityCreate({ name: 'John', notes: '' })
  if (!update) throw new Error('expected an update')
  const rows: ConflictRowView[] = [
    {
      id: 'entity_mara',
      kind: 'entity',
      reason: 'revision_mismatch',
      revision: 4,
      fields: { name: 'Mara Quinn', notes: 'Kept' },
    },
    {
      id: 'prop_new',
      kind: 'property',
      reason: 'dangling_name',
      revision: 1,
      fields: { statement: 'Mara is tired.', entity_id: 'entity_mara' },
    },
  ]
  expect(writesWithCurrentRevisions([update, create], rows)).toEqual([
    { ...update, revision: 4 },
    create,
  ])
  expect(conflictRowLabel(rows[0])).toBe('Mara Quinn')
  expect(conflictRowLabel(rows[1])).toBe('Mara is tired.')
  expect(editedRecordGone([update], rows)).toBe(false)
})

test('a conflict row that is missing is gone, and its write is not given a revision', () => {
  const remove = recordDelete(mara)
  const gone: ConflictRowView = {
    id: 'entity_mara',
    kind: null,
    reason: 'missing',
    revision: null,
    fields: null,
  }
  expect(conflictRowIsGone(gone)).toBe(true)
  expect(conflictRowLabel(gone)).toBeNull()
  expect(writesWithCurrentRevisions([remove], [gone])).toEqual([remove])
  expect(editedRecordGone([remove], [gone])).toBe(true)
  expect(recordGone([gone], 'entity_mara')).toBe(true)
  expect(recordGone([gone], 'entity_john')).toBe(false)
})
