import { expect, test } from 'vitest'

import {
  DEFAULT_LAYOUT_SETTINGS,
  entityGroups,
  fcoseOptions,
  layoutSeed,
  seededPositions,
  type LayoutEdgeElement,
  type LayoutElement,
  type PositionEdge,
  type PositionNode,
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

test('seed 0 is the story id alone, and another seed gives another start', () => {
  expect(layoutSeed('story_1', 0)).toBe('story_1')
  expect(layoutSeed('story_1', 3)).not.toBe('story_1')
})

test('every plain setting but the seed reaches fcose', () => {
  const options = fcoseOptions({ ...DEFAULT_LAYOUT_SETTINGS, seed: 7, gravity: 0.01 })
  expect(options).toMatchObject({ name: 'fcose', gravity: 0.01, fit: true })
  expect(options).not.toHaveProperty('seed')
  expect(options).not.toHaveProperty('kinds')
})

test('a node pushes by its kind, a box by the box setting, and an edge follows its source or its field', () => {
  const kinds = {
    ...DEFAULT_LAYOUT_SETTINGS.kinds,
    entity: { nodeRepulsion: 80000, idealEdgeLength: 1, edgeElasticity: 1 },
    property: { nodeRepulsion: 3000, idealEdgeLength: 20, edgeElasticity: 2 },
  }
  const options = fcoseOptions({
    ...DEFAULT_LAYOUT_SETTINGS,
    kinds,
    propertyToEntity: { idealEdgeLength: 15, edgeElasticity: 3 },
    boxRepulsion: 500,
  })
  const repulsion = options.nodeRepulsion as (node: LayoutElement) => number
  const length = options.idealEdgeLength as (edge: LayoutEdgeElement) => number
  const elasticity = options.edgeElasticity as (edge: LayoutEdgeElement) => number

  expect(repulsion(element('entity'))).toBe(80000)
  expect(repulsion(element('property'))).toBe(3000)
  expect(repulsion(element('group'))).toBe(500)

  const ownership = line('property', 'entity_id')
  expect(length(ownership)).toBe(15)
  expect(elasticity(ownership)).toBe(3)

  const cause = line('property', 'caused_by')
  expect(length(cause)).toBe(20)
  expect(elasticity(cause)).toBe(2)

  // An Assertion's entity_ids is not ownership, and it follows the Assertion.
  const named = line('assertion', 'entity_ids')
  expect(length(named)).toBe(DEFAULT_LAYOUT_SETTINGS.kinds.assertion.idealEdgeLength)
})

function element(kind: string): LayoutElement {
  return { data: (key: string) => (key === 'kind' ? kind : undefined) }
}

function line(sourceKind: string, fields: string): LayoutEdgeElement {
  return {
    data: (key: string) => (key === 'fields' ? fields : undefined),
    source: () => element(sourceKind),
  }
}

test('an entity that owns properties shares one box with them, and nothing else is boxed', () => {
  const nodes = [
    node('entity_a', 'entity'),
    node('entity_b', 'entity'),
    node('entity_lone', 'entity'),
    node('prop_a', 'property'),
    node('prop_b', 'property'),
    node('prop_c', 'property'),
    node('assertion_a', 'assertion'),
  ]
  const edges = [
    edge('prop_a', 'entity_a', ['entity_id']),
    edge('prop_b', 'entity_a', ['entity_id', 'caused_by']),
    edge('prop_c', 'entity_b', ['entity_id']),
    edge('assertion_a', 'entity_lone', ['entity_ids']),
  ]
  const groups = entityGroups(nodes, edges)
  expect(Object.fromEntries(groups)).toEqual({
    entity_a: 'group:entity_a',
    prop_a: 'group:entity_a',
    prop_b: 'group:entity_a',
    entity_b: 'group:entity_b',
    prop_c: 'group:entity_b',
  })
})

function node(id: string, kind: string): PositionNode {
  return { id, kind }
}

function edge(from: string, to: string, fields: string[]): PositionEdge {
  return { from, to, fields }
}

function entries(positions: Map<string, { x: number; y: number }>) {
  return [...positions.entries()].sort(([left], [right]) => left.localeCompare(right))
}
