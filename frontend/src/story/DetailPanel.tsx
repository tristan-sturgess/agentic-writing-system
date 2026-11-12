import { Badge, CloseButton, Group, Stack, Text } from '@mantine/core'

import type { Story } from '../api/client'
import { labelOf, type RecordIndex } from './records'
import { references, type Reference } from './references'
import { Empty, Prose, RecordId, RecordLink, When, type SelectRecord } from './parts'

const FIELD_LABEL: Record<string, string> = {
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

const KIND_LABEL = {
  entity: 'Entity',
  property: 'Property',
  assertion: 'Assertion',
  event: 'Event',
  unit: 'Narrative Unit',
  arc: 'Arc',
} as const

type Found = {
  kind: keyof typeof KIND_LABEL
  label: string
}

/**
 * The record named in `?record=`: its fields as stored, what it names, and
 * what names it. Read-only until editing lands.
 */
export function DetailPanel({
  story,
  index,
  recordId,
  onSelect,
  onClose,
}: {
  story: Story
  index: RecordIndex
  recordId: string
  onSelect: SelectRecord
  onClose: () => void
}) {
  const found = findRecord(story, recordId)
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          {found ? (
            <>
              <Text size="xs" c="dimmed">
                {KIND_LABEL[found.kind]}
              </Text>
              <Text fw={700}>{found.label}</Text>
            </>
          ) : (
            <Text fw={700}>Unknown record</Text>
          )}
          <RecordId id={recordId} />
        </div>
        <CloseButton aria-label="Close the record" onClick={onClose} />
      </Group>
      {found ? (
        <RecordBody story={story} index={index} recordId={recordId} onSelect={onSelect} />
      ) : (
        <Empty>There is no record with this id in the story.</Empty>
      )}
    </Stack>
  )
}

function RecordBody({
  story,
  index,
  recordId,
  onSelect,
}: {
  story: Story
  index: RecordIndex
  recordId: string
  onSelect: SelectRecord
}) {
  const refs = references(story)
  const outgoing = refs.filter((ref) => ref.from === recordId)
  const incoming = refs.filter((ref) => ref.to === recordId)
  return (
    <>
      <StoredFields story={story} index={index} recordId={recordId} onSelect={onSelect} />
      <ReferenceGroups
        title="Names"
        refs={outgoing}
        story={story}
        index={index}
        onSelect={onSelect}
        other={(ref) => ref.to}
      />
      <ReferenceGroups
        title="Named by"
        refs={incoming}
        story={story}
        index={index}
        onSelect={onSelect}
        other={(ref) => ref.from}
      />
    </>
  )
}

function StoredFields({
  story,
  index,
  recordId,
  onSelect,
}: {
  story: Story
  index: RecordIndex
  recordId: string
  onSelect: SelectRecord
}) {
  const entity = story.entities.find((item) => item.id === recordId)
  if (entity) {
    return entity.notes ? <Prose>{entity.notes}</Prose> : <Empty>No notes</Empty>
  }
  const property = story.properties.find((item) => item.id === recordId)
  if (property) {
    return (
      <Stack gap="xs">
        <When spans={property.when} index={index} empty="No time recorded" />
        {property.supersedes && (
          <Text size="sm">
            Supersedes:{' '}
            <RecordLink id={property.supersedes} onSelect={onSelect}>
              {labelOf(index, property.supersedes)}
            </RecordLink>
          </Text>
        )}
      </Stack>
    )
  }
  const assertion = story.assertions.find((item) => item.id === recordId)
  if (assertion) {
    return (
      <Stack gap="xs">
        <When spans={assertion.when} index={index} empty="No time recorded" />
        {assertion.supersedes && (
          <Text size="sm">
            Supersedes:{' '}
            <RecordLink id={assertion.supersedes} onSelect={onSelect}>
              {labelOf(index, assertion.supersedes)}
            </RecordLink>
          </Text>
        )}
      </Stack>
    )
  }
  const event = story.events.find((item) => item.id === recordId)
  if (event) {
    return (
      <Stack gap="xs">
        {event.description && <Prose>{event.description}</Prose>}
        <When spans={event.when} index={index} empty="Time unspecified" />
      </Stack>
    )
  }
  const arc = story.arcs.find((item) => item.id === recordId)
  if (arc) {
    return arc.description ? <Prose>{arc.description}</Prose> : <Empty>No description</Empty>
  }
  const unit = story.units.find((item) => item.id === recordId)
  if (unit) {
    return (
      <Stack gap="xs">
        {unit.summary && <Prose>{unit.summary}</Prose>}
        {unit.notes && (
          <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
            Notes: {unit.notes}
          </Text>
        )}
        {unit.prose && <Prose>{unit.prose}</Prose>}
        {!unit.summary && !unit.notes && !unit.prose && <Empty>No summary, notes, or prose</Empty>}
      </Stack>
    )
  }
  return null
}

function ReferenceGroups({
  title,
  refs,
  story,
  index,
  onSelect,
  other,
}: {
  title: string
  refs: Reference[]
  story: Story
  index: RecordIndex
  onSelect: SelectRecord
  other: (ref: Reference) => string
}) {
  const groups: { field: string; ids: string[] }[] = []
  for (const ref of refs) {
    const id = other(ref)
    const group = groups.find((item) => item.field === ref.field)
    if (group) group.ids.push(id)
    else groups.push({ field: ref.field, ids: [id] })
  }
  return (
    <div>
      <Text fw={600} size="sm" mb={4}>
        {title}
      </Text>
      {groups.length === 0 ? (
        <Empty>None</Empty>
      ) : (
        <Stack gap="xs">
          {groups.map((group) => (
            <div key={group.field}>
              <Text size="xs" c="dimmed">
                {FIELD_LABEL[group.field] ?? group.field}
              </Text>
              <Group gap={6}>
                {group.ids.map((id) =>
                  id === story.id ? (
                    <Badge key={id} variant="light" color="gray" tt="none">
                      {story.title || 'This story'}
                    </Badge>
                  ) : (
                    <RecordLink key={id} id={id} onSelect={onSelect}>
                      {labelOf(index, id)}
                    </RecordLink>
                  ),
                )}
              </Group>
            </div>
          ))}
        </Stack>
      )}
    </div>
  )
}

function findRecord(story: Story, id: string): Found | null {
  const entity = story.entities.find((item) => item.id === id)
  if (entity) return { kind: 'entity', label: entity.name }
  const property = story.properties.find((item) => item.id === id)
  if (property) return { kind: 'property', label: property.statement }
  const assertion = story.assertions.find((item) => item.id === id)
  if (assertion) return { kind: 'assertion', label: assertion.statement }
  const event = story.events.find((item) => item.id === id)
  if (event) return { kind: 'event', label: event.title }
  const unit = story.units.find((item) => item.id === id)
  if (unit) return { kind: 'unit', label: unit.title }
  const arc = story.arcs.find((item) => item.id === id)
  if (arc) return { kind: 'arc', label: arc.title }
  return null
}
