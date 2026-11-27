import { Badge, Button, CloseButton, Group, List, Stack, Text } from '@mantine/core'
import { useState } from 'react'

import type { Entity, Story } from '../api/client'
import { DeleteRecord } from './DeleteRecord'
import { EntityForm } from './EntityForm'
import { labelOf, type RecordIndex } from './records'
import {
  byKind,
  groupReferences,
  kindOfReferrer,
  REFERRER_LABEL,
  type ReferenceGroup,
} from './referenceGroups'
import { references } from './references'
import { Empty, Prose, RecordId, RecordLink, When, type SelectRecord } from './parts'
import { recordUpdate } from './writes'

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

const DELETE_PROMPT = {
  entity: 'Delete this Entity? Its Properties are deleted with it.',
} as const

type Found = {
  kind: keyof typeof KIND_LABEL
  label: string
}

/**
 * The record named in `?record=`: its fields as stored, what it names, and
 * what names it. An Entity can be edited and deleted here. The other kinds
 * stay read-only until their editors are built.
 *
 * Keyed by the record id, so opening another record starts from its stored fields.
 */
export function DetailPanel(props: {
  story: Story
  index: RecordIndex
  recordId: string
  onSelect: SelectRecord
  onClose: () => void
  /** Close the panel after a delete, without asking about an edit. */
  onRemoved: () => void
  onReload: () => Promise<void>
  onDirtyChange: (dirty: boolean) => void
}) {
  return <PanelBody key={props.recordId} {...props} />
}

function PanelBody({
  story,
  index,
  recordId,
  onSelect,
  onClose,
  onRemoved,
  onReload,
  onDirtyChange,
}: {
  story: Story
  index: RecordIndex
  recordId: string
  onSelect: SelectRecord
  onClose: () => void
  onRemoved: () => void
  onReload: () => Promise<void>
  onDirtyChange: (dirty: boolean) => void
}) {
  const found = findRecord(story, recordId)
  const entity = story.entities.find((item) => item.id === recordId) ?? null
  // The record as it was when Edit or Delete was pressed. The write is built
  // against this copy, not the one a later reload brings, so a record that
  // moved under the form is a conflict rather than a silent overwrite.
  const [editing, setEditing] = useState<Entity | null>(null)
  const [confirming, setConfirming] = useState<Entity | null>(null)
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
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
      {entity && !editing && !confirming && (
        <Group gap="xs" wrap="wrap">
          <Button type="button" onClick={() => setEditing(entity)}>
            Edit
          </Button>
          <Button type="button" color="red" variant="light" onClick={() => setConfirming(entity)}>
            Delete
          </Button>
        </Group>
      )}
      {editing ? (
        <EntityForm
          recordId={editing.id}
          initialValues={{ name: editing.name, notes: editing.notes }}
          buildWrite={(draft) => recordUpdate('entity', editing, draft)}
          storyId={story.id}
          index={index}
          onSelect={onSelect}
          onDirtyChange={onDirtyChange}
          onCancel={() => setEditing(null)}
          onDiscard={() => {
            setEditing(null)
            void onReload()
          }}
          onLanded={async () => {
            await onReload()
            setEditing(null)
          }}
        />
      ) : confirming ? (
        <DeleteRecord
          target={confirming}
          prompt={DELETE_PROMPT.entity}
          storyId={story.id}
          index={index}
          onSelect={onSelect}
          onCancel={() => setConfirming(null)}
          onReload={onReload}
          onDeleted={async () => {
            await onReload()
            onRemoved()
          }}
        />
      ) : found ? (
        <StoredFields story={story} index={index} recordId={recordId} />
      ) : (
        <Empty>There is no record with this id in the story.</Empty>
      )}
      {found && (
        <RecordLinks story={story} index={index} recordId={recordId} onSelect={onSelect} />
      )}
    </Stack>
  )
}

function RecordLinks({
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
  const arc = story.arcs.some((item) => item.id === recordId)
  return (
    <>
      <ReferenceGroups
        title="Names"
        groups={groupReferences(outgoing, (ref) => ref.to, (ref) => ref.field)}
        labelOfGroup={(key) => FIELD_LABEL[key] ?? key}
        ordered={(key) => arc && key === 'event_ids'}
        story={story}
        index={index}
        onSelect={onSelect}
      />
      <ReferenceGroups
        title="Named by"
        groups={byKind(
          groupReferences(incoming, (ref) => ref.from, (_ref, id) =>
            kindOfReferrer(index, story.id, id),
          ),
        )}
        labelOfGroup={(key) => REFERRER_LABEL[key] ?? key}
        story={story}
        index={index}
        onSelect={onSelect}
      />
    </>
  )
}

function StoredFields({
  story,
  index,
  recordId,
}: {
  story: Story
  index: RecordIndex
  recordId: string
}) {
  const entity = story.entities.find((item) => item.id === recordId)
  if (entity) {
    return entity.notes ? <Prose>{entity.notes}</Prose> : <Empty>No notes</Empty>
  }
  const property = story.properties.find((item) => item.id === recordId)
  if (property) {
    return <When spans={property.when} index={index} empty="No time recorded" />
  }
  const assertion = story.assertions.find((item) => item.id === recordId)
  if (assertion) {
    return <When spans={assertion.when} index={index} empty="No time recorded" />
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
  groups,
  labelOfGroup,
  ordered,
  story,
  index,
  onSelect,
}: {
  title: string
  groups: ReferenceGroup[]
  labelOfGroup: (key: string) => string
  /** An Arc's Events are numbered, because that list order is the Arc's own order. */
  ordered?: (key: string) => boolean
  story: Story
  index: RecordIndex
  onSelect: SelectRecord
}) {
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
            <div key={group.key}>
              <Text size="xs" c="dimmed">
                {labelOfGroup(group.key)}
              </Text>
              <List
                size="sm"
                spacing={4}
                type={ordered?.(group.key) ? 'ordered' : 'unordered'}
              >
                {group.ids.map((id) => (
                  <List.Item key={id}>
                    {id === story.id ? (
                      <Badge variant="light" color="gray" tt="none">
                        {story.title || 'This story'}
                      </Badge>
                    ) : (
                      <RecordLink id={id} onSelect={onSelect}>
                        {labelOf(index, id)}
                      </RecordLink>
                    )}
                  </List.Item>
                ))}
              </List>
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
