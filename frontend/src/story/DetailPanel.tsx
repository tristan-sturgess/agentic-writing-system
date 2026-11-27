import { Badge, Button, CloseButton, Group, List, Stack, Text } from '@mantine/core'
import { useState } from 'react'

import type {
  Arc,
  Assertion,
  Entity,
  NarrativeUnit,
  Property,
  Story,
  StoryEvent,
  Write,
} from '../api/client'
import { ArcForm } from './ArcForm'
import { AssertionForm } from './AssertionForm'
import { DeleteRecord } from './DeleteRecord'
import { EntityForm } from './EntityForm'
import { EventForm } from './EventForm'
import { fieldLabel } from './fieldLabels'
import { PropertyForm } from './PropertyForm'
import { UnitForm } from './UnitForm'
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
import type { CreateRequest } from './CreatePanel'
import { deleteUnitWrites, unitOwner } from './units'
import { recordDelete, recordUpdate } from './writes'

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
  property: 'Delete this Property?',
  assertion: 'Delete this Assertion?',
  event: 'Delete this Event?',
  arc: 'Delete this Arc?',
  unit: 'Delete this Narrative Unit? It is taken out of the list that holds it. A unit that still has units inside it cannot be deleted.',
} as const

type Held =
  | { kind: 'entity'; record: Entity }
  | { kind: 'property'; record: Property }
  | { kind: 'assertion'; record: Assertion }
  | { kind: 'event'; record: StoryEvent }
  | { kind: 'unit'; record: NarrativeUnit }
  | { kind: 'arc'; record: Arc }

/**
 * The record named in `?record=`: its fields as stored, what it names, and
 * what names it. Edit and delete work for every kind. The write is built from
 * the copy taken when Edit or Delete was pressed.
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
  onBeginCreate: (request: CreateRequest) => void
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
  onBeginCreate,
}: {
  story: Story
  index: RecordIndex
  recordId: string
  onSelect: SelectRecord
  onClose: () => void
  onRemoved: () => void
  onReload: () => Promise<void>
  onDirtyChange: (dirty: boolean) => void
  onBeginCreate: (request: CreateRequest) => void
}) {
  const found = hold(story, recordId)
  // The record as it was when Edit or Delete was pressed. The write is built
  // against this copy, not the one a later reload brings, so a record that
  // moved under the form is a conflict rather than a silent overwrite.
  const [editing, setEditing] = useState<Held | null>(null)
  const [confirming, setConfirming] = useState<Held | null>(null)
  const formProps = {
    story,
    storyId: story.id,
    index,
    onSelect,
    onDirtyChange,
    onCancel: () => setEditing(null),
    onDiscard: () => {
      setEditing(null)
      void onReload()
    },
    onLanded: async () => {
      await onReload()
      setEditing(null)
    },
  }
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          {found ? (
            <>
              <Text size="xs" c="dimmed">
                {KIND_LABEL[found.kind]}
              </Text>
              <Text fw={700}>{heldLabel(found)}</Text>
            </>
          ) : (
            <Text fw={700}>Unknown record</Text>
          )}
          <RecordId id={recordId} />
        </div>
        <CloseButton aria-label="Close the record" onClick={onClose} />
      </Group>
      {found && !editing && !confirming && (
        <Group gap="xs" wrap="wrap">
          <Button type="button" onClick={() => setEditing(found)}>
            Edit
          </Button>
          <Button type="button" color="red" variant="light" onClick={() => setConfirming(found)}>
            Delete
          </Button>
          {found.kind === 'entity' && (
            <Button
              type="button"
              variant="default"
              onClick={() => onBeginCreate({ kind: 'property', entityId: found.record.id })}
            >
              Add Property
            </Button>
          )}
          {found.kind === 'unit' && (
            <Button
              type="button"
              variant="default"
              onClick={() => onBeginCreate({ kind: 'unit', parentId: found.record.id })}
            >
              Add a unit inside
            </Button>
          )}
        </Group>
      )}
      {editing ? (
        <RecordEditor held={editing} {...formProps} />
      ) : confirming ? (
        <DeleteRecord
          writes={deleteWrites(confirming, story)}
          recordId={confirming.record.id}
          prompt={DELETE_PROMPT[confirming.kind]}
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
        <StoredFields story={story} recordId={recordId} index={index} />
      ) : (
        <Empty>There is no record with this id in the story.</Empty>
      )}
      {found && (
        <RecordLinks story={story} index={index} recordId={recordId} onSelect={onSelect} />
      )}
    </Stack>
  )
}

function RecordEditor({
  held,
  story,
  storyId,
  index,
  onSelect,
  onDirtyChange,
  onCancel,
  onDiscard,
  onLanded,
}: {
  held: Held
  story: Story
  storyId: string
  index: RecordIndex
  onSelect: SelectRecord
  onDirtyChange: (dirty: boolean) => void
  onCancel: () => void
  onDiscard: () => void
  onLanded: () => Promise<void>
}) {
  const shared = { storyId, index, onSelect, onDirtyChange, onCancel, onDiscard, onLanded }
  switch (held.kind) {
    case 'entity':
      return (
        <EntityForm
          {...shared}
          recordId={held.record.id}
          initialValues={{ name: held.record.name, notes: held.record.notes }}
          buildWrites={(draft) => {
            const write = recordUpdate('entity', held.record, draft)
            return write ? [write] : null
          }}
        />
      )
    case 'property':
      return <PropertyForm {...shared} story={story} property={held.record} />
    case 'event':
      return <EventForm {...shared} story={story} event={held.record} />
    case 'arc':
      return <ArcForm {...shared} story={story} arc={held.record} />
    case 'assertion':
      return <AssertionForm {...shared} story={story} assertion={held.record} />
    case 'unit':
      return <UnitForm {...shared} story={story} unit={held.record} prose={held.record.prose} />
  }
}

function deleteWrites(held: Held, story: Story): Write[] {
  if (held.kind === 'unit') return deleteUnitWrites(held.record, unitOwner(story, held.record.id))
  return [recordDelete(held.record)]
}

function heldLabel(held: Held): string {
  switch (held.kind) {
    case 'entity':
      return held.record.name
    case 'property':
    case 'assertion':
      return held.record.statement
    case 'event':
    case 'unit':
    case 'arc':
      return held.record.title
  }
}

function hold(story: Story, id: string): Held | null {
  const entity = story.entities.find((item) => item.id === id)
  if (entity) return { kind: 'entity', record: entity }
  const property = story.properties.find((item) => item.id === id)
  if (property) return { kind: 'property', record: property }
  const assertion = story.assertions.find((item) => item.id === id)
  if (assertion) return { kind: 'assertion', record: assertion }
  const event = story.events.find((item) => item.id === id)
  if (event) return { kind: 'event', record: event }
  const unit = story.units.find((item) => item.id === id)
  if (unit) return { kind: 'unit', record: unit }
  const arc = story.arcs.find((item) => item.id === id)
  if (arc) return { kind: 'arc', record: arc }
  return null
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
        labelOfGroup={(key) => fieldLabel(key)}
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
              <List size="sm" spacing={4} type={ordered?.(group.key) ? 'ordered' : 'unordered'}>
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
