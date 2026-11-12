import { expect, test } from 'vitest'

import type { Property, Story } from '../api/client'
import { indexRecords, labelOf, propertiesByEntity } from './records'

function property(id: string, entityId: string): Property {
  return {
    id,
    entity_id: entityId,
    statement: `The statement of ${id}.`,
    when: [],
    caused_by: null,
    supersedes: null,
    revision: 1,
  }
}

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
  unit_ids: [],
  entities: [
    { id: 'entity_mara', name: 'Mara', notes: '', revision: 1 },
    { id: 'entity_john', name: 'John', notes: '', revision: 1 },
  ],
  properties: [
    property('prop_one', 'entity_mara'),
    property('prop_two', 'entity_john'),
    property('prop_three', 'entity_mara'),
  ],
  assertions: [],
  events: [
    {
      id: 'event_arrival',
      title: 'Arrival',
      description: '',
      entity_ids: [],
      when: [],
      revision: 1,
    },
  ],
  units: [],
  arcs: [],
}

test('a reference is shown as the record it names', () => {
  const index = indexRecords(story)
  expect(labelOf(index, 'entity_mara')).toBe('Mara')
  expect(labelOf(index, 'event_arrival')).toBe('Arrival')
  expect(index.get('prop_two')).toEqual({
    kind: 'property',
    label: 'The statement of prop_two.',
  })
})

test('an id that is not in the story is shown as the id, not as a blank', () => {
  expect(labelOf(indexRecords(story), 'event_gone')).toBe('event_gone')
})

test('each Entity gets its own Properties, in the order the story lists them', () => {
  const byEntity = propertiesByEntity(story)
  expect(byEntity.get('entity_mara')?.map((p) => p.id)).toEqual(['prop_one', 'prop_three'])
  expect(byEntity.get('entity_john')?.map((p) => p.id)).toEqual(['prop_two'])
})
