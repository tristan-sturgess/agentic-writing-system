// Where a story's nodes start, and the random numbers fcose draws while it
// runs. Both come from the story id, so one story is placed the same way on
// every load. fcose still calls Math.random after randomize is turned off.

export type NodePosition = { x: number; y: number }

/**
 * A property's `entity_id` edge. That is the ownership link, as distinct from
 * `entity_ids` on an Assertion or an Event.
 */
export function isOwnershipEdge(fields: readonly string[]): boolean {
  return fields.includes('entity_id')
}

/** Gap the spring rests at, in pixels between the node boxes. */
export function idealEdgeLength(fields: readonly string[], neighborhood: boolean): number {
  if (!neighborhood) return 90
  return isOwnershipEdge(fields) ? 32 : 360
}

/**
 * How hard the spring pulls toward that gap. A higher value holds the gap
 * against the other springs. fcose multiplies this by how far the gap is
 * from the ideal.
 */
export function edgeElasticity(fields: readonly string[], neighborhood: boolean): number {
  if (!neighborhood) return 0.45
  return isOwnershipEdge(fields) ? 2.4 : 0.1
}

/** How hard this node pushes others away. Properties yield; entities do not. */
export function nodeRepulsion(kind: string, neighborhood: boolean): number {
  if (!neighborhood) return 12000
  if (kind === 'property') return 5500
  if (kind === 'entity') return 80000
  return 16000
}

const SPREAD = 900

/** One position per id. The same seed and the same ids give the same positions. */
export function seededPositions(seed: string, ids: readonly string[]): Map<string, NodePosition> {
  const random = mulberry32(hashString(seed))
  const positions = new Map<string, NodePosition>()
  for (const id of [...ids].sort()) {
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * SPREAD
    positions.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  }
  return positions
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
