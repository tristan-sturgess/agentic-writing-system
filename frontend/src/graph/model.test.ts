/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

import type { Story } from '../api/client'
import { indexRecords } from '../story/records'
import { graphOf, type GraphEdge } from './model'

function story(extra: Partial<Story> = {}): Story {
  return {
    id: 'story_1',
    schema_version: 1,
    revision: 1,
    created_at: '2026-11-12T00:00:00Z',
    updated_at: '2026-11-12T00:00:00Z',
    title: 'A story',
    description: '',
    premise: '',
    tone: '',
    themes: '',
    writing_style: '',
    unit_ids: [],
    entities: [],
    properties: [],
    assertions: [],
    events: [],
    units: [],
    arcs: [],
    ...extra,
  }
}

function edge(graphEdges: GraphEdge[], from: string, to: string): GraphEdge | undefined {
  return graphEdges.find((item) => item.from === from && item.to === to)
}

test('two fields between one pair of records become one edge', () => {
  const doc = story({
    entities: [{ id: 'entity_a', name: 'A', notes: '', revision: 1 }],
    events: [
      {
        id: 'event_1',
        title: 'One',
        description: '',
        entity_ids: [],
        when: [],
        revision: 1,
      },
    ],
    properties: [
      {
        id: 'prop_1',
        entity_id: 'entity_a',
        statement: 'A holds.',
        when: [{ kind: 'at', at: { event_id: 'event_1', edge: 'start' } }],
        caused_by: 'event_1',
        revision: 1,
      },
    ],
    assertions: [
      {
        id: 'assertion_1',
        entity_ids: [],
        event_ids: ['event_1'],
        arc_ids: [],
        statement: 'One follows.',
        when: [{ kind: 'at', at: { event_id: 'event_1', edge: 'end' } }],
        caused_by: 'event_1',
        revision: 1,
      },
    ],
  })

  const graph = graphOf(doc, indexRecords(doc), new Set())

  expect(edge(graph.edges, 'prop_1', 'event_1')).toEqual({
    from: 'prop_1',
    to: 'event_1',
    fields: ['caused_by', 'when'],
  })
  expect(edge(graph.edges, 'assertion_1', 'event_1')).toEqual({
    from: 'assertion_1',
    to: 'event_1',
    fields: ['event_ids', 'caused_by', 'when'],
  })
  expect(graph.edges.filter((item) => item.from === 'prop_1' && item.to === 'event_1')).toHaveLength(1)
})

test('the story node and its unit_ids edges', () => {
  const doc = story({
    unit_ids: ['unit_act'],
    units: [
      {
        id: 'unit_act',
        title: 'Act',
        summary: '',
        notes: '',
        child_ids: [],
        subject_ids: [],
        prose: '',
        revision: 1,
      },
    ],
  })

  const graph = graphOf(doc, indexRecords(doc), new Set())

  expect(graph.nodes[0]).toEqual({ id: 'story_1', kind: 'story', label: 'A story' })
  expect(edge(graph.edges, 'story_1', 'unit_act')).toEqual({
    from: 'story_1',
    to: 'unit_act',
    fields: ['unit_ids'],
  })
  expect(graph.unconnected).not.toContain('unit_act')
  expect(graph.unconnected).not.toContain('story_1')

  const hiddenUnits = graphOf(doc, indexRecords(doc), new Set(['unit']))
  expect(hiddenUnits.nodes.map((node) => node.id)).not.toContain('story_1')
  expect(hiddenUnits.edges).toEqual([])
})

test('a time point that names an Event becomes an edge', () => {
  const doc = story({
    events: [
      {
        id: 'event_1',
        title: 'One',
        description: '',
        entity_ids: [],
        when: [],
        revision: 1,
      },
      {
        id: 'event_2',
        title: 'Two',
        description: '',
        entity_ids: [],
        when: [{ kind: 'at', at: { event_id: 'event_1', edge: 'start' } }],
        revision: 1,
      },
    ],
  })

  const graph = graphOf(doc, indexRecords(doc), new Set())

  expect(edge(graph.edges, 'event_2', 'event_1')).toEqual({
    from: 'event_2',
    to: 'event_1',
    fields: ['when'],
  })
})

test('hiding a kind drops its nodes and the edges that touch them', () => {
  const doc = story({
    entities: [{ id: 'entity_a', name: 'A', notes: '', revision: 1 }],
    events: [
      {
        id: 'event_1',
        title: 'One',
        description: '',
        entity_ids: ['entity_a'],
        when: [],
        revision: 1,
      },
      {
        id: 'event_2',
        title: 'Two',
        description: '',
        entity_ids: [],
        when: [{ kind: 'at', at: { event_id: 'event_1', edge: 'end' } }],
        revision: 1,
      },
    ],
  })
  const index = indexRecords(doc)
  const shown = graphOf(doc, index, new Set())
  const hidden = graphOf(doc, index, new Set(['entity']))

  expect(shown.counts).toEqual(hidden.counts)
  expect(hidden.counts.entity).toBe(1)
  expect(hidden.nodes.map((node) => node.id)).not.toContain('entity_a')
  expect(edge(hidden.edges, 'event_1', 'entity_a')).toBeUndefined()
  expect(edge(hidden.edges, 'event_2', 'event_1')).toEqual({
    from: 'event_2',
    to: 'event_1',
    fields: ['when'],
  })
})

test('a record that connects to nothing stays unconnected when its kind is hidden', () => {
  const doc = story({
    entities: [
      { id: 'entity_a', name: 'A', notes: '', revision: 1 },
      { id: 'entity_stray', name: 'Stray', notes: '', revision: 1 },
    ],
    events: [
      {
        id: 'event_1',
        title: 'One',
        description: '',
        entity_ids: ['entity_a'],
        when: [],
        revision: 1,
      },
      {
        id: 'event_orphan',
        title: 'Orphan',
        description: '',
        entity_ids: [],
        when: [],
        revision: 1,
      },
    ],
  })

  const hidden = graphOf(doc, indexRecords(doc), new Set(['entity']))

  expect(hidden.unconnected).toEqual(['entity_stray', 'event_orphan'])
  expect(hidden.nodes.map((node) => node.id)).not.toContain('entity_stray')
  expect(hidden.nodes.map((node) => node.id)).toContain('event_orphan')
})

test('two records that each name the other are two edges', () => {
  const doc = story({
    events: [
      {
        id: 'event_1',
        title: 'One',
        description: '',
        entity_ids: [],
        when: [{ kind: 'at', at: { event_id: 'event_2', edge: 'start' } }],
        revision: 1,
      },
      {
        id: 'event_2',
        title: 'Two',
        description: '',
        entity_ids: [],
        when: [{ kind: 'at', at: { event_id: 'event_1', edge: 'end' } }],
        revision: 1,
      },
    ],
  })

  const graph = graphOf(doc, indexRecords(doc), new Set())

  expect(edge(graph.edges, 'event_1', 'event_2')?.fields).toEqual(['when'])
  expect(edge(graph.edges, 'event_2', 'event_1')?.fields).toEqual(['when'])
})

test('every record in sample_story.json becomes a node', () => {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../samples/sample_story.json')
  const raw = JSON.parse(readFileSync(path, 'utf8')) as SampleFile
  const doc = storyFromSample(raw)
  const graph = graphOf(doc, indexRecords(doc), new Set())
  const nodeIds = new Set(graph.nodes.map((node) => node.id))

  const records = [
    ...doc.entities,
    ...doc.properties,
    ...doc.assertions,
    ...doc.events,
    ...doc.units,
    ...doc.arcs,
  ]
  expect(records.length).toBeGreaterThan(0)
  for (const record of records) {
    expect(nodeIds.has(record.id)).toBe(true)
  }
  expect(nodeIds.has(doc.id)).toBe(true)
  expect(graph.nodes).toHaveLength(records.length + 1)
  expect(graph.counts).toEqual({
    entity: doc.entities.length,
    property: doc.properties.length,
    assertion: doc.assertions.length,
    event: doc.events.length,
    unit: doc.units.length,
    arc: doc.arcs.length,
  })
  expect(graph.nodes.find((node) => node.id === 'entity_elin_voss')?.label).toBe('Elin Voss')
  expect(edge(graph.edges, doc.id, 'unit_act_one')?.fields).toEqual(['unit_ids'])
})

type SampleRecord = { id: string } & Record<string, unknown>

type SampleFile = {
  title?: string
  description?: string
  premise?: string
  tone?: string
  themes?: string
  writing_style?: string
  unit_ids?: string[]
  entities?: SampleRecord[]
  properties?: SampleRecord[]
  assertions?: SampleRecord[]
  events?: SampleRecord[]
  units?: SampleRecord[]
  arcs?: SampleRecord[]
}

function storyFromSample(raw: SampleFile): Story {
  return story({
    title: raw.title ?? '',
    description: raw.description ?? '',
    premise: raw.premise ?? '',
    tone: raw.tone ?? '',
    themes: raw.themes ?? '',
    writing_style: raw.writing_style ?? '',
    unit_ids: raw.unit_ids ?? [],
    entities: (raw.entities ?? []).map((record) => ({
      name: '',
      notes: '',
      ...record,
      revision: 1,
    })),
    properties: (raw.properties ?? []).map((record) => ({
      entity_id: '',
      statement: '',
      when: [],
      caused_by: null,
      ...record,
      revision: 1,
    })),
    assertions: (raw.assertions ?? []).map((record) => ({
      entity_ids: [],
      event_ids: [],
      arc_ids: [],
      statement: '',
      when: [],
      caused_by: null,
      ...record,
      revision: 1,
    })),
    events: (raw.events ?? []).map((record) => ({
      title: '',
      description: '',
      entity_ids: [],
      when: [],
      ...record,
      revision: 1,
    })),
    units: (raw.units ?? []).map((record) => ({
      title: '',
      summary: '',
      notes: '',
      child_ids: [],
      subject_ids: [],
      prose: '',
      ...record,
      revision: 1,
    })),
    arcs: (raw.arcs ?? []).map((record) => ({
      title: '',
      description: '',
      event_ids: [],
      ...record,
      revision: 1,
    })),
  })
}
