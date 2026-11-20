import { expect, test } from 'vitest'

import {
  edgeElasticity,
  idealEdgeLength,
  isOwnershipEdge,
  nodeRepulsion,
  seededPositions,
  withSeededRandom,
} from './layout'

test('one seed gives the same positions, whatever order the ids arrive in', () => {
  const ids = ['entity_b', 'entity_a', 'event_c']
  const first = seededPositions('story_1', ids)
  const second = seededPositions('story_1', [...ids].reverse())

  expect(entries(second)).toEqual(entries(first))
  expect(entries(seededPositions('story_2', ids))).not.toEqual(entries(first))
  expect(first.get('entity_a')).not.toEqual(first.get('entity_b'))
})

test('Math.random follows the seed while a layout runs, then the original returns', () => {
  const original = Math.random
  const during: number[] = []
  withSeededRandom('story_1', () => {
    expect(Math.random).not.toBe(original)
    during.push(Math.random(), Math.random())
  })
  expect(Math.random).toBe(original)

  const again: number[] = []
  withSeededRandom('story_1', () => {
    again.push(Math.random(), Math.random())
  })
  expect(again).toEqual(during)
})

test('a property stays on a shorter, stiffer spring than the other edges', () => {
  expect(isOwnershipEdge(['entity_id'])).toBe(true)
  expect(isOwnershipEdge(['entity_ids'])).toBe(false)
  expect(isOwnershipEdge(['entity_id', 'caused_by'])).toBe(true)

  const ownership = ['entity_id']
  const between = ['entity_ids']
  expect(idealEdgeLength(ownership, true)).toBeLessThan(idealEdgeLength(between, true))
  expect(edgeElasticity(ownership, true)).toBeGreaterThan(edgeElasticity(between, true))
  expect(nodeRepulsion('property', true)).toBeLessThan(nodeRepulsion('entity', true))
  expect(nodeRepulsion('event', true)).toBeLessThan(nodeRepulsion('entity', true))

  expect(idealEdgeLength(ownership, false)).toBe(idealEdgeLength(between, false))
  expect(edgeElasticity(ownership, false)).toBe(edgeElasticity(between, false))
  expect(nodeRepulsion('property', false)).toBe(nodeRepulsion('entity', false))
})

function entries(positions: Map<string, { x: number; y: number }>) {
  return [...positions.entries()].sort(([left], [right]) => left.localeCompare(right))
}
