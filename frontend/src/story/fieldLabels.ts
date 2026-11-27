/** The label a field is shown under, in the panel and on a conflict. */
export const FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  notes: 'Notes',
  title: 'Title',
  statement: 'Statement',
  description: 'Description',
  summary: 'Summary',
  premise: 'Premise',
  tone: 'Tone',
  themes: 'Themes',
  writing_style: 'Writing style',
  prose: 'Prose',
  entity_id: 'Entity',
  entity_ids: 'Entities',
  event_ids: 'Events',
  arc_ids: 'Arcs',
  caused_by: 'Caused by',
  when: 'When',
  child_ids: 'Units inside',
  subject_ids: 'Depicts',
  unit_ids: 'In the story',
}

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field
}
