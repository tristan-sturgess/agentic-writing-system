import { expect, test } from 'vitest'

import type { Story } from '../api/client'
import { references } from './references'

const story: Story = {
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
  unit_ids: ['unit_act'],
  entities: [{ id: 'entity_a', name: 'A', notes: '', revision: 1 }],
  properties: [
    {
      id: 'prop_1',
      entity_id: 'entity_a',
      statement: 'A holds.',
      when: [{ kind: 'at', at: { event_id: 'event_1', edge: 'start' } }],
      caused_by: 'event_1',
      supersedes: 'prop_2',
      revision: 1,
    },
    {
      id: 'prop_2',
      entity_id: 'entity_a',
      statement: 'A held.',
      when: [],
      caused_by: null,
      supersedes: null,
      revision: 1,
    },
  ],
  assertions: [
    {
      id: 'assertion_1',
      entity_ids: ['entity_a'],
      event_ids: ['event_1'],
      arc_ids: ['arc_1'],
      statement: 'A follows.',
      when: [
        {
          kind: 'range',
          start: { event_id: 'event_2', edge: 'end' },
          end: { event_id: 'event_2', edge: 'start' },
        },
      ],
      caused_by: 'event_2',
      supersedes: null,
      revision: 1,
    },
  ],
  events: [
    {
      id: 'event_1',
      title: 'One',
      description: '',
      entity_ids: ['entity_a'],
      when: [{ kind: 'at', at: { timestamp: '1921-01-01' } }],
      revision: 1,
    },
    {
      id: 'event_2',
      title: 'Two',
      description: '',
      entity_ids: [],
      when: [
        { kind: 'at', at: { event_id: 'event_1', edge: 'start' } },
        { kind: 'at', at: { event_id: 'event_1', edge: 'end' } },
      ],
      revision: 1,
    },
  ],
  units: [
    {
      id: 'unit_act',
      title: 'Act',
      summary: '',
      notes: '',
      child_ids: ['unit_scene'],
      subject_ids: ['entity_a', 'event_1', 'arc_1'],
      prose: '',
      revision: 1,
    },
    {
      id: 'unit_scene',
      title: 'Scene',
      summary: '',
      notes: '',
      child_ids: [],
      subject_ids: [],
      prose: '',
      revision: 1,
    },
  ],
  arcs: [
    {
      id: 'arc_1',
      title: 'The arc',
      description: '',
      event_ids: ['event_1', 'event_2'],
      revision: 1,
    },
  ],
}

test('a reference is the id fields in "How the records connect"', () => {
  expect(references(story)).toEqual([
    { from: 'story_1', to: 'unit_act', field: 'unit_ids' },
    { from: 'prop_1', to: 'entity_a', field: 'entity_id' },
    { from: 'prop_1', to: 'event_1', field: 'caused_by' },
    { from: 'prop_1', to: 'event_1', field: 'when' },
    { from: 'prop_2', to: 'entity_a', field: 'entity_id' },
    { from: 'assertion_1', to: 'entity_a', field: 'entity_ids' },
    { from: 'assertion_1', to: 'event_1', field: 'event_ids' },
    { from: 'assertion_1', to: 'arc_1', field: 'arc_ids' },
    { from: 'assertion_1', to: 'event_2', field: 'caused_by' },
    { from: 'assertion_1', to: 'event_2', field: 'when' },
    { from: 'event_1', to: 'entity_a', field: 'entity_ids' },
    { from: 'event_2', to: 'event_1', field: 'when' },
    { from: 'unit_act', to: 'unit_scene', field: 'child_ids' },
    { from: 'unit_act', to: 'entity_a', field: 'subject_ids' },
    { from: 'unit_act', to: 'event_1', field: 'subject_ids' },
    { from: 'unit_act', to: 'arc_1', field: 'subject_ids' },
    { from: 'arc_1', to: 'event_1', field: 'event_ids' },
    { from: 'arc_1', to: 'event_2', field: 'event_ids' },
  ])
})

test('supersedes is a field on the statement, not a reference', () => {
  expect(references(story).some((ref) => ref.field === 'supersedes')).toBe(false)
  expect(references(story).some((ref) => ref.to === 'prop_2' && ref.from === 'prop_1')).toBe(
    false,
  )
})
