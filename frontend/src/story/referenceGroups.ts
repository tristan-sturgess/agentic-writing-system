// How the detail panel groups a record's references. "Names" stays grouped by
// the field that holds the id. "Named by" is grouped by the kind of the record
// that holds it, so an Arc that lists an Event appears under Arcs.

import type { RecordIndex } from './records'
import type { Reference } from './references'

export type ReferenceGroup = {
  key: string
  ids: string[]
}

/**
 * Groups references in the order they appear. The same id is listed once in
 * a group, even when two fields on one record both name it.
 */
export function groupReferences(
  refs: readonly Reference[],
  other: (ref: Reference) => string,
  keyOf: (ref: Reference, id: string) => string,
): ReferenceGroup[] {
  const groups: ReferenceGroup[] = []
  for (const ref of refs) {
    const id = other(ref)
    const key = keyOf(ref, id)
    const group = groups.find((item) => item.key === key)
    if (group) {
      if (!group.ids.includes(id)) group.ids.push(id)
    } else {
      groups.push({ key, ids: [id] })
    }
  }
  return groups
}

const KIND_RANK: Record<string, number> = {
  entity: 0,
  property: 1,
  assertion: 2,
  event: 3,
  unit: 4,
  arc: 5,
  story: 6,
}

/** A stable section order for "Named by": Entities through Arcs, then the story. */
export function byKind(groups: readonly ReferenceGroup[]): ReferenceGroup[] {
  return [...groups].sort((a, b) => (KIND_RANK[a.key] ?? 7) - (KIND_RANK[b.key] ?? 7))
}

/** The section key for a record that names this one. The story itself is `story`. */
export function kindOfReferrer(index: RecordIndex, storyId: string, id: string): string {
  if (id === storyId) return 'story'
  return index.get(id)?.kind ?? 'unknown'
}

export const REFERRER_LABEL: Record<string, string> = {
  entity: 'Entities',
  property: 'Properties',
  assertion: 'Assertions',
  event: 'Events',
  unit: 'Narrative Units',
  arc: 'Arcs',
  story: 'Story',
  unknown: 'Unknown',
}
