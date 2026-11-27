import { expect, test } from 'vitest'

import type { ChangeView, CommitView } from '../api/client'
import { changedFields, changeLabel, revertedBy } from './changes'

function change(patch: Partial<ChangeView> & Pick<ChangeView, 'op'>): ChangeView {
  return {
    record_id: 'entity_mara',
    kind: 'entity',
    before: { name: 'Mara', notes: '' },
    after: { name: 'Mara Voss', notes: '' },
    ...patch,
  }
}

function commit(id: string, reverts: string[] = []): CommitView {
  return {
    commit_id: id,
    committed_at: '2026-01-01T00:00:00Z',
    source: reverts.length > 0 ? 'revert' : 'user',
    thread_id: null,
    run_id: null,
    tool_call_id: null,
    reverts,
    changes: [],
  }
}

test('changeLabel reads the after-image, and a delete reads before', () => {
  expect(changeLabel(change({ op: 'update' }))).toBe('Mara Voss')
  expect(changeLabel(change({ op: 'create', before: null, after: { name: 'Mara' } }))).toBe(
    'Mara',
  )
  expect(
    changeLabel(change({ op: 'delete', before: { name: 'Mara' }, after: null })),
  ).toBe('Mara')
  expect(changeLabel(change({ op: 'update', kind: 'story', after: { title: '' } }))).toBe(null)
})

test('changedFields lists only the fields that differ, after then before', () => {
  expect(
    changedFields(
      { name: 'Mara', notes: 'Old', caused_by: null },
      { name: 'Mara Voss', notes: 'Old', extra: 'yes' },
    ),
  ).toEqual(['name', 'extra'])
  expect(changedFields(null, { name: 'Mara', notes: '' })).toEqual(['name', 'notes'])
  expect(changedFields({ name: 'Mara' }, null)).toEqual(['name'])
  // A missing edge and a null edge are one time point.
  expect(
    changedFields({ at: { event_id: 'event_arrival' } }, { at: { event_id: 'event_arrival', edge: null } }),
  ).toEqual([])
})

test('revertedBy maps a commit to the revert that undid it', () => {
  const edit = commit('edit')
  const undo = commit('undo', ['edit'])
  expect(revertedBy([undo, edit]).get('edit')).toBe('undo')
  expect(revertedBy([undo, edit]).has('undo')).toBe(false)
})

test('reverting a revert puts the original commit back', () => {
  const edit = commit('edit')
  const undo = commit('undo', ['edit'])
  const redo = commit('redo', ['undo'])
  const by = revertedBy([redo, undo, edit])
  expect(by.get('undo')).toBe('redo')
  expect(by.has('edit')).toBe(false)

  const undoAgain = commit('undo-again', ['redo'])
  const again = revertedBy([undoAgain, redo, undo, edit])
  expect(again.get('edit')).toBe('undo')
  expect(again.get('redo')).toBe('undo-again')
  expect(again.has('undo')).toBe(false)
})
