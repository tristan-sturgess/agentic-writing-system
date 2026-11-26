import type { Property, Story } from '../api/client'

export type RecordKind = 'entity' | 'property' | 'assertion' | 'event' | 'unit' | 'arc'

/** What a screen shows in place of a record id. */
export type RecordSummary = {
  kind: RecordKind
  /** The text a person reads: a name, a title, or a statement. */
  label: string
}

export type RecordIndex = ReadonlyMap<string, RecordSummary>

/** Every record in the story by id, so a reference can be shown as its label. */
export function indexRecords(story: Story): RecordIndex {
  const index = new Map<string, RecordSummary>()
  for (const entity of story.entities) {
    index.set(entity.id, { kind: 'entity', label: entity.name })
  }
  for (const property of story.properties) {
    index.set(property.id, { kind: 'property', label: property.statement })
  }
  for (const assertion of story.assertions) {
    index.set(assertion.id, { kind: 'assertion', label: assertion.statement })
  }
  for (const event of story.events) {
    index.set(event.id, { kind: 'event', label: event.title })
  }
  for (const unit of story.units) {
    index.set(unit.id, { kind: 'unit', label: unit.title })
  }
  for (const arc of story.arcs) {
    index.set(arc.id, { kind: 'arc', label: arc.title })
  }
  return index
}

/**
 * The label for an id. The service refuses a dangling reference, so every id
 * should be in the index; if one is not, the id itself is shown, not a blank.
 */
export function labelOf(index: RecordIndex, recordId: string): string {
  return index.get(recordId)?.label ?? recordId
}

/** Each Entity's Properties, in the order the story lists them. */
export function propertiesByEntity(story: Story): ReadonlyMap<string, Property[]> {
  const byEntity = new Map<string, Property[]>()
  for (const property of story.properties) {
    const owned = byEntity.get(property.entity_id)
    if (owned) {
      owned.push(property)
    } else {
      byEntity.set(property.entity_id, [property])
    }
  }
  return byEntity
}
