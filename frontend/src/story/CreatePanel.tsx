// The detail panel while a new record is being created. The request names the
// kind, and the fields a create starts from, such as the Entity a new Property
// belongs to or the time a new Event was picked from.

import type { Committed, Span, Story } from '../api/client'
import { ArcForm } from './ArcForm'
import { AssertionForm } from './AssertionForm'
import { EntityForm } from './EntityForm'
import { EventForm } from './EventForm'
import { PropertyForm } from './PropertyForm'
import { UnitForm } from './UnitForm'
import type { SelectRecord } from './parts'
import { labelOf, type RecordIndex } from './records'
import { CREATED_REF, createdId, entityCreate } from './writes'

export type CreateRequest =
  | { kind: 'entity' }
  | { kind: 'property'; entityId: string }
  | { kind: 'event'; when?: Span[] }
  | { kind: 'arc' }
  | { kind: 'assertion' }
  | { kind: 'unit'; parentId?: string }

export function CreatePanel({
  request,
  story,
  index,
  onSelect,
  onClose,
  onDirtyChange,
  onCancel,
  onReload,
  onCreated,
}: {
  request: CreateRequest
  story: Story
  index: RecordIndex
  onSelect: SelectRecord
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
  /** Leave the create without saving. */
  onCancel: () => void
  onReload: () => Promise<void>
  /** The create landed and the story has been loaded again. */
  onCreated: (id: string | null) => void
}) {
  async function onLanded(committed: Committed) {
    await onReload()
    onCreated(createdId(committed, CREATED_REF))
  }
  const shared = {
    story,
    storyId: story.id,
    index,
    onSelect,
    onClose,
    onDirtyChange,
    onCancel,
    onDiscard: () => {
      onCancel()
      void onReload()
    },
    onLanded,
  }
  switch (request.kind) {
    case 'entity':
      return (
        <EntityForm
          heading="New Entity"
          recordId={null}
          initialValues={{ name: '', notes: '' }}
          buildWrites={(draft) => [entityCreate(draft)]}
          storyId={shared.storyId}
          index={index}
          onSelect={onSelect}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          onCancel={onCancel}
          onDiscard={shared.onDiscard}
          onLanded={onLanded}
        />
      )
    case 'property':
      return (
        <PropertyForm
          {...shared}
          heading={`New Property of ${labelOf(index, request.entityId)}`}
          entityId={request.entityId}
        />
      )
    case 'event':
      return <EventForm {...shared} heading="New Event" initialWhen={request.when} />
    case 'arc':
      return <ArcForm {...shared} heading="New Arc" />
    case 'assertion':
      return <AssertionForm {...shared} heading="New Assertion" />
    case 'unit':
      return (
        <UnitForm {...shared} heading="New Narrative Unit" parentId={request.parentId ?? 'story'} />
      )
  }
}
