// A Narrative Unit is placed by a list, the story's or a parent's, so creating,
// moving, and deleting one are each a single commit. A unit that sits in no
// list, or in two, is refused.

import type { Write } from '../api/client'
import { CREATED_REF, recordDelete, sameValue } from './writes'

/** The id a later write uses for the unit this commit creates. */
export const CREATED_PLACE = `@${CREATED_REF}`

export type ListOwner =
  | { kind: 'story'; revision: number; ids: readonly string[] }
  | { kind: 'unit'; id: string; revision: number; ids: readonly string[] }

type StoryLists = {
  revision: number
  unit_ids: readonly string[]
  units: readonly { id: string; revision: number; child_ids: readonly string[] }[]
}

export type UnitCreateFields = {
  title: string
  summary: string
  notes: string
  subject_ids: readonly string[]
}

/** Where `id` sits once it has been taken out and put back at `position`. */
export function moveId(ids: readonly string[], id: string, position: number): string[] {
  return insertId(removeId(ids, id), id, position)
}

export function removeId(ids: readonly string[], id: string): string[] {
  return ids.filter((item) => item !== id)
}

/** `position` is clamped to the list. The id is inserted there. */
export function insertId(ids: readonly string[], id: string, position: number): string[] {
  const next = [...ids]
  const at = Math.max(0, Math.min(position, next.length))
  next.splice(at, 0, id)
  return next
}

/**
 * The index to give `moveId` so the unit stays where it is. A unit that is not
 * in the list is placed at the end.
 */
export function currentPosition(ids: readonly string[], unitId: string): number {
  const index = ids.indexOf(unitId)
  return index === -1 ? ids.length : index
}

export type PlacementChoice = { position: number; afterId: string | null }

/**
 * The positions a unit can take in a list. `selfId` is left out, because a
 * unit is not placed after itself. The first choice is the start of the list.
 */
export function placementChoices(ids: readonly string[], selfId: string | null): PlacementChoice[] {
  const others = selfId == null ? [...ids] : ids.filter((id) => id !== selfId)
  return [
    { position: 0, afterId: null },
    ...others.map((id, index) => ({ position: index + 1, afterId: id })),
  ]
}

/** The units inside `rootId`, not including it. */
export function descendantIds(
  units: readonly { id: string; child_ids: readonly string[] }[],
  rootId: string,
): Set<string> {
  const byId = new Map(units.map((unit) => [unit.id, unit]))
  const found = new Set<string>()
  const stack = [...(byId.get(rootId)?.child_ids ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()
    if (id == null || found.has(id)) continue
    found.add(id)
    const child = byId.get(id)
    if (child) stack.push(...child.child_ids)
  }
  return found
}

/** The list that holds this unit, or null when it is in none. */
export function unitOwner(story: StoryLists, unitId: string): ListOwner | null {
  if (story.unit_ids.includes(unitId)) {
    return { kind: 'story', revision: story.revision, ids: story.unit_ids }
  }
  const parent = story.units.find((unit) => unit.child_ids.includes(unitId))
  if (!parent) return null
  return { kind: 'unit', id: parent.id, revision: parent.revision, ids: parent.child_ids }
}

/** The list a placement names. `parentId` of `story` is the story's `unit_ids`. */
export function ownerByParent(story: StoryLists, parentId: string): ListOwner | null {
  if (parentId === 'story') {
    return { kind: 'story', revision: story.revision, ids: story.unit_ids }
  }
  const parent = story.units.find((unit) => unit.id === parentId)
  if (!parent) return null
  return { kind: 'unit', id: parent.id, revision: parent.revision, ids: parent.child_ids }
}

function sameOwner(a: ListOwner, b: ListOwner): boolean {
  if (a.kind === 'story' || b.kind === 'story') return a.kind === 'story' && b.kind === 'story'
  return a.id === b.id
}

function listWrite(owner: ListOwner, ids: readonly string[]): Write | null {
  if (sameValue([...ids], [...owner.ids])) return null
  if (owner.kind === 'story') {
    return { op: 'set_story', revision: owner.revision, fields: { unit_ids: [...ids] } } as Write
  }
  return {
    op: 'update',
    kind: 'unit',
    id: owner.id,
    revision: owner.revision,
    fields: { child_ids: [...ids] },
  } as Write
}

/**
 * The create, then the parent list with `@created` at `position`. The ref has
 * to be minted before the list can name it, and the unit has to be placed in
 * the same commit or the save is refused.
 */
export function createUnitWrites(
  fields: UnitCreateFields,
  owner: ListOwner,
  position: number,
): Write[] {
  const create: Write = {
    op: 'create',
    kind: 'unit',
    ref: CREATED_REF,
    fields: {
      title: fields.title,
      summary: fields.summary,
      notes: fields.notes,
      subject_ids: [...fields.subject_ids],
      child_ids: [],
      prose: '',
    },
  }
  const placed = listWrite(owner, insertId(owner.ids, CREATED_PLACE, position))
  return placed ? [create, placed] : [create]
}

/**
 * The list updates that move a unit. One update when it stays under the same
 * parent. The old list and the new one when it does not. Empty when the move
 * leaves both lists as they are.
 */
export function moveUnitWrites(
  unitId: string,
  from: ListOwner,
  to: ListOwner,
  position: number,
): Write[] {
  if (sameOwner(from, to)) {
    const write = listWrite(from, moveId(from.ids, unitId, position))
    return write ? [write] : []
  }
  const writes: Write[] = []
  const removed = listWrite(from, removeId(from.ids, unitId))
  if (removed) writes.push(removed)
  const inserted = listWrite(to, insertId(to.ids, unitId, position))
  if (inserted) writes.push(inserted)
  return writes
}

/**
 * The parent list without the unit, then the delete. `owner` null is a unit
 * that is already in no list: only the delete is sent.
 */
export function deleteUnitWrites(
  unit: { id: string; revision: number },
  owner: ListOwner | null,
): Write[] {
  const writes: Write[] = []
  if (owner) {
    const removed = listWrite(owner, removeId(owner.ids, unit.id))
    if (removed) writes.push(removed)
  }
  writes.push(recordDelete(unit))
  return writes
}
