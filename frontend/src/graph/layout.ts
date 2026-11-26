// Where a story's nodes start, the random numbers fcose draws while it runs,
// and the settings it runs with. The start and the random numbers come from
// the story id and the seed, so one story and one set of settings are placed
// the same way on every run. fcose still calls Math.random after randomize is
// turned off.

export type NodePosition = { x: number; y: number }

export type PositionNode = { id: string; kind: string }

export type PositionEdge = { from: string; to: string; fields: readonly string[] }

/** The node kinds with their own forces. The story node is one; a box is not. */
export const LAYOUT_KINDS = ['entity', 'property', 'assertion', 'event', 'unit', 'arc', 'story'] as const

export type LayoutKind = (typeof LAYOUT_KINDS)[number]

/**
 * The forces for one kind. `nodeRepulsion` is how hard its nodes push others
 * away. The edge settings apply to the lines that start at its nodes, the
 * record that holds the reference.
 */
export type LineSettings = {
  idealEdgeLength: number
  edgeElasticity: number
}

export type KindSettings = LineSettings & {
  nodeRepulsion: number
}

/**
 * The settings the graph's layout panel edits. `seed` picks the start, `kinds`
 * and `boxRepulsion` become fcose's per-node and per-edge functions, and the
 * rest are fcose options as they are.
 */
export type LayoutSettings = {
  seed: number
  quality: 'draft' | 'default' | 'proof'
  randomize: boolean
  nodeDimensionsIncludeLabels: boolean
  uniformNodeDimensions: boolean
  tile: boolean
  sampleSize: number
  nodeSeparation: number
  kinds: Record<LayoutKind, KindSettings>
  /** The line from a Property to its Entity, by `entity_id`. Its other lines follow `kinds.property`. */
  propertyToEntity: LineSettings
  boxRepulsion: number
  nestingFactor: number
  numIter: number
  gravity: number
  gravityRange: number
  gravityCompound: number
  gravityRangeCompound: number
  initialEnergyOnIncremental: number
  tilingPaddingVertical: number
  tilingPaddingHorizontal: number
}

/** The baseline the owner chose from the layout panel on `large_story`. */
export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  seed: 7,
  quality: 'default',
  randomize: true,
  nodeDimensionsIncludeLabels: true,
  uniformNodeDimensions: false,
  tile: true,
  sampleSize: 25,
  nodeSeparation: 120,
  kinds: {
    entity: { nodeRepulsion: 12000, idealEdgeLength: 90, edgeElasticity: 0.45 },
    property: { nodeRepulsion: 96500, idealEdgeLength: 490, edgeElasticity: 0 },
    assertion: { nodeRepulsion: 32500, idealEdgeLength: 210, edgeElasticity: 0.2 },
    event: { nodeRepulsion: 66000, idealEdgeLength: 240, edgeElasticity: 0.2 },
    unit: { nodeRepulsion: 28000, idealEdgeLength: 300, edgeElasticity: 0.2 },
    arc: { nodeRepulsion: 57000, idealEdgeLength: 350, edgeElasticity: 0.2 },
    story: { nodeRepulsion: 12000, idealEdgeLength: 90, edgeElasticity: 0.45 },
  },
  propertyToEntity: { idealEdgeLength: 120, edgeElasticity: 2 },
  boxRepulsion: 24500,
  nestingFactor: 2,
  numIter: 2500,
  gravity: 0.12,
  gravityRange: 15.8,
  gravityCompound: 2.05,
  gravityRangeCompound: 1.2,
  initialEnergyOnIncremental: 0.55,
  tilingPaddingVertical: 10,
  tilingPaddingHorizontal: 10,
}

/** The part of a Cytoscape element the per-kind functions read. */
export type LayoutElement = { data(key: string): unknown }

export type LayoutEdgeElement = LayoutElement & { source(): LayoutElement }

/**
 * The fcose options for `settings`. A node's repulsion comes from its kind, or
 * `boxRepulsion` for a box. An edge's length and elasticity come from the kind
 * of its source, except a Property's `entity_id` line, which has its own. The
 * edge's `fields` data is its field names joined by ", ". The layout fits the
 * window and does not animate.
 */
export function fcoseOptions(settings: LayoutSettings): { name: 'fcose'; [option: string]: unknown } {
  const { kinds, propertyToEntity, boxRepulsion, ...rest } = settings
  const options: Partial<typeof rest> = { ...rest }
  delete options.seed
  const forKind = (element: LayoutElement): KindSettings | undefined =>
    kinds[element.data('kind') as LayoutKind]
  const forLine = (edge: LayoutEdgeElement): LineSettings => {
    const source = edge.source()
    const fields = String(edge.data('fields') ?? '').split(', ')
    if (source.data('kind') === 'property' && isOwnershipEdge(fields)) return propertyToEntity
    return forKind(source) ?? DEFAULT_LAYOUT_SETTINGS.kinds.entity
  }
  return {
    ...options,
    nodeRepulsion: (node: LayoutElement) => forKind(node)?.nodeRepulsion ?? boxRepulsion,
    idealEdgeLength: (edge: LayoutEdgeElement) => forLine(edge).idealEdgeLength,
    edgeElasticity: (edge: LayoutEdgeElement) => forLine(edge).edgeElasticity,
    name: 'fcose',
    animate: false,
    fit: true,
    padding: 36,
    packComponents: false,
  }
}

/** The string the start positions and the random numbers are drawn from. */
export function layoutSeed(storyId: string, seed: number): string {
  return seed === 0 ? storyId : `${storyId}#${seed}`
}

/**
 * A property's `entity_id` edge. That is the ownership link, as distinct from
 * `entity_ids` on an Assertion or an Event.
 */
export function isOwnershipEdge(fields: readonly string[]): boolean {
  return fields.includes('entity_id')
}

const SPREAD = 900

/** One position per id. The same seed and the same ids give the same positions. */
export function seededPositions(seed: string, ids: readonly string[]): Map<string, NodePosition> {
  const random = mulberry32(hashString(seed))
  const positions = new Map<string, NodePosition>()
  for (const id of [...ids].sort()) {
    positions.set(id, diskPosition(random))
  }
  return positions
}

/**
 * The box each node is drawn in: one box per entity that owns a property,
 * holding the entity and its properties. Nodes outside every box are absent.
 * The value is the box's node id.
 */
export function entityGroups(
  nodes: readonly PositionNode[],
  edges: readonly PositionEdge[],
): Map<string, string> {
  const kindOf = new Map(nodes.map((node) => [node.id, node.kind]))
  const groups = new Map<string, string>()
  for (const edge of edges) {
    if (!isOwnershipEdge(edge.fields)) continue
    if (kindOf.get(edge.from) !== 'property' || kindOf.get(edge.to) !== 'entity') continue
    const groupId = `group:${edge.to}`
    groups.set(edge.to, groupId)
    groups.set(edge.from, groupId)
  }
  return groups
}

/** Run `body` with `Math.random` replaced by a sequence from `seed`. */
export function withSeededRandom<T>(seed: string, body: () => T): T {
  const random = mulberry32(hashString(`${seed}:random`))
  const original = Math.random
  Math.random = () => random()
  try {
    return body()
  } finally {
    Math.random = original
  }
}

function diskPosition(random: () => number): NodePosition {
  const angle = random() * Math.PI * 2
  const radius = Math.sqrt(random()) * SPREAD
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}
