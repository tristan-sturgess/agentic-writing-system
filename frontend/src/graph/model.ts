// The graph of a story: one node per record, plus the story, and one edge per
// pair of records a reference joins. The screen draws this. It does not decide it.

import type { Story } from '../api/client'
import { references } from '../story/references'
import type { RecordIndex, RecordKind } from '../story/records'

/** The kinds a filter can hide, in the order the chips show them. */
export const RECORD_KINDS = [
  'entity',
  'property',
  'assertion',
  'event',
  'unit',
  'arc',
] as const satisfies readonly RecordKind[]

export type GraphNode = {
  id: string
  /** `story` is the story itself, which is not a record. */
  kind: RecordKind | 'story'
  label: string
}

export type GraphEdge = {
  from: string
  to: string
  /** The stored fields that carry this reference, in the order `references` yields them. */
  fields: string[]
}

export type GraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /**
   * Records with no reference in either direction.
   * Computed on the whole story, before `hidden` is applied.
   */
  unconnected: string[]
  /** How many records each kind has, before `hidden` is applied. */
  counts: Record<RecordKind, number>
}

/**
 * Nodes, merged edges, records that connect to nothing, and a count per kind.
 *
 * An edge is one pair of records. Two fields that name the same record, such
 * as `event_ids` and `caused_by`, are one edge that lists both. Hiding a kind
 * drops its nodes and every edge that touches them. The story node hides with
 * the Narrative Units, because its only edges go to them. The unconnected ids
 * and the counts do not change with the filter.
 */
export function graphOf(
  story: Story,
  index: RecordIndex,
  hidden: ReadonlySet<RecordKind>,
): GraphData {
  const counts = emptyCounts()
  for (const summary of index.values()) counts[summary.kind] += 1

  const degree = new Map<string, number>()
  for (const id of index.keys()) degree.set(id, 0)
  const refs = references(story)
  for (const ref of refs) {
    if (degree.has(ref.from)) degree.set(ref.from, (degree.get(ref.from) ?? 0) + 1)
    if (degree.has(ref.to)) degree.set(ref.to, (degree.get(ref.to) ?? 0) + 1)
  }
  const unconnected = [...index.keys()].filter((id) => degree.get(id) === 0)

  const hideStory = hidden.has('unit')
  const nodes: GraphNode[] = []
  if (!hideStory) {
    nodes.push({ id: story.id, kind: 'story', label: story.title || 'Untitled story' })
  }
  for (const [id, summary] of index) {
    if (hidden.has(summary.kind)) continue
    nodes.push({ id, kind: summary.kind, label: summary.label })
  }

  const visible = new Set(nodes.map((node) => node.id))
  const edges: GraphEdge[] = []
  const byPair = new Map<string, GraphEdge>()
  for (const ref of refs) {
    if (!visible.has(ref.from) || !visible.has(ref.to)) continue
    const key = `${ref.from}\0${ref.to}`
    const existing = byPair.get(key)
    if (existing) {
      if (!existing.fields.includes(ref.field)) existing.fields.push(ref.field)
      continue
    }
    const edge = { from: ref.from, to: ref.to, fields: [ref.field] }
    byPair.set(key, edge)
    edges.push(edge)
  }

  return { nodes, edges, unconnected, counts }
}

function emptyCounts(): Record<RecordKind, number> {
  return { entity: 0, property: 0, assertion: 0, event: 0, unit: 0, arc: 0 }
}
