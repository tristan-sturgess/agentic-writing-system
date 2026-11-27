import { expect, test } from 'vitest'

import {
  CREATED_PLACE,
  createUnitWrites,
  currentPosition,
  deleteUnitWrites,
  descendantIds,
  moveUnitWrites,
  ownerByParent,
  placementChoices,
  unitOwner,
  type ListOwner,
} from './units'

const story = {
  revision: 4,
  unit_ids: ['unit_act'],
  units: [
    { id: 'unit_act', revision: 2, child_ids: ['unit_chapter', 'unit_scene'] },
    { id: 'unit_chapter', revision: 3, child_ids: ['unit_scene_two'] },
    { id: 'unit_scene', revision: 1, child_ids: [] },
    { id: 'unit_scene_two', revision: 1, child_ids: [] },
  ],
}

const storyList: ListOwner = { kind: 'story', revision: 4, ids: ['unit_act'] }
const actList: ListOwner = {
  kind: 'unit',
  id: 'unit_act',
  revision: 2,
  ids: ['unit_chapter', 'unit_scene'],
}

test('a create places @created in the parent list, in the same commit', () => {
  expect(
    createUnitWrites(
      { title: 'Act Two', summary: '', notes: '', subject_ids: ['entity_mara'] },
      storyList,
      1,
    ),
  ).toEqual([
    {
      op: 'create',
      kind: 'unit',
      ref: 'created',
      fields: {
        title: 'Act Two',
        summary: '',
        notes: '',
        subject_ids: ['entity_mara'],
        child_ids: [],
        prose: '',
      },
    },
    {
      op: 'set_story',
      revision: 4,
      fields: { unit_ids: ['unit_act', CREATED_PLACE] },
    },
  ])
  expect(CREATED_PLACE).toBe('@created')
})

test('a move under the same parent is one list update, and no move is none', () => {
  expect(moveUnitWrites('unit_scene', actList, actList, 0)).toEqual([
    {
      op: 'update',
      kind: 'unit',
      id: 'unit_act',
      revision: 2,
      fields: { child_ids: ['unit_scene', 'unit_chapter'] },
    },
  ])
  expect(moveUnitWrites('unit_scene', actList, actList, currentPosition(actList.ids, 'unit_scene'))).toEqual(
    [],
  )
})

test('a move to another parent updates the list it leaves and the list it joins', () => {
  const chapter = ownerByParent(story, 'unit_chapter')
  expect(chapter && moveUnitWrites('unit_scene', actList, chapter, 1)).toEqual([
    {
      op: 'update',
      kind: 'unit',
      id: 'unit_act',
      revision: 2,
      fields: { child_ids: ['unit_chapter'] },
    },
    {
      op: 'update',
      kind: 'unit',
      id: 'unit_chapter',
      revision: 3,
      fields: { child_ids: ['unit_scene_two', 'unit_scene'] },
    },
  ])
})

test('a delete takes the unit out of its parent list and then deletes it', () => {
  expect(deleteUnitWrites({ id: 'unit_act', revision: 2 }, storyList)).toEqual([
    { op: 'set_story', revision: 4, fields: { unit_ids: [] } },
    { op: 'delete', id: 'unit_act', revision: 2 },
  ])
  expect(deleteUnitWrites({ id: 'unit_loose', revision: 1 }, null)).toEqual([
    { op: 'delete', id: 'unit_loose', revision: 1 },
  ])
})

test('the owner of a unit is the one list that holds it', () => {
  expect(unitOwner(story, 'unit_act')).toEqual(storyList)
  expect(unitOwner(story, 'unit_scene_two')).toEqual({
    kind: 'unit',
    id: 'unit_chapter',
    revision: 3,
    ids: ['unit_scene_two'],
  })
  expect(unitOwner(story, 'unit_missing')).toBeNull()
  expect(ownerByParent(story, 'story')).toEqual(storyList)
})

test('placement choices skip the unit itself, and descendants are the units inside it', () => {
  expect(placementChoices(['unit_chapter', 'unit_scene'], 'unit_scene')).toEqual([
    { position: 0, afterId: null },
    { position: 1, afterId: 'unit_chapter' },
  ])
  expect(currentPosition(['unit_chapter', 'unit_scene'], 'unit_scene')).toBe(1)
  expect([...descendantIds(story.units, 'unit_act')].sort()).toEqual([
    'unit_chapter',
    'unit_scene',
    'unit_scene_two',
  ])
  expect(descendantIds(story.units, 'unit_scene').size).toBe(0)
})
