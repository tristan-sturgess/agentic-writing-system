// The detail panel while a new record is being created. The request names the
// kind, and later kinds add the fields a create starts from, such as the
// Entity a new Property belongs to.

import type { Story } from '../api/client'
import { EntityForm } from './EntityForm'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { CREATED_REF, createdId, entityCreate } from './writes'

export type CreateRequest = { kind: 'entity' }

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
  switch (request.kind) {
    case 'entity':
      return (
        <EntityForm
          heading="New Entity"
          recordId={null}
          initialValues={{ name: '', notes: '' }}
          buildWrite={entityCreate}
          storyId={story.id}
          index={index}
          onSelect={onSelect}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          onCancel={onCancel}
          onDiscard={() => {
            onCancel()
            void onReload()
          }}
          onLanded={async (committed) => {
            await onReload()
            onCreated(createdId(committed, CREATED_REF))
          }}
        />
      )
  }
}
