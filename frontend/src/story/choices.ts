import type { Story } from '../api/client'

export type Choice = { value: string; label: string }

export function entityChoices(story: Story): Choice[] {
  return story.entities.map((entity) => ({ value: entity.id, label: entity.name }))
}

export function eventChoices(story: Story): Choice[] {
  return story.events.map((event) => ({ value: event.id, label: event.title }))
}

export function arcChoices(story: Story): Choice[] {
  return story.arcs.map((arc) => ({ value: arc.id, label: arc.title }))
}

export function unitChoices(story: Story, except: ReadonlySet<string>): Choice[] {
  return story.units
    .filter((unit) => !except.has(unit.id))
    .map((unit) => ({ value: unit.id, label: unit.title }))
}

/** Entities, Events, and Arcs, for a field that can name any of them. */
export function subjectChoices(story: Story): { group: string; items: Choice[] }[] {
  return [
    { group: 'Entities', items: entityChoices(story) },
    { group: 'Events', items: eventChoices(story) },
    { group: 'Arcs', items: arcChoices(story) },
  ].filter((group) => group.items.length > 0)
}
