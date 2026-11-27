// The Entity form: a create, or an edit of name and notes.

import { Textarea, TextInput } from '@mantine/core'

import type { Committed, Write } from '../api/client'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { RecordForm } from './RecordForm'
import type { EntityDraft } from './writes'

export function EntityForm({
  heading,
  recordId,
  initialValues,
  buildWrites,
  storyId,
  index,
  onSelect,
  onClose,
  onDirtyChange,
  onCancel,
  onDiscard,
  onLanded,
}: {
  heading?: string
  recordId: string | null
  initialValues: EntityDraft
  buildWrites: (draft: EntityDraft) => readonly Write[] | null
  storyId: string
  index: RecordIndex
  onSelect: SelectRecord
  onClose?: () => void
  onDirtyChange: (dirty: boolean) => void
  onCancel: () => void
  onDiscard: () => void
  onLanded: (committed: Committed) => Promise<void>
}) {
  return (
    <RecordForm
      heading={heading}
      recordId={recordId}
      goneId={recordId === null ? undefined : recordId}
      initialValues={initialValues}
      buildWrites={buildWrites}
      storyId={storyId}
      index={index}
      onSelect={onSelect}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      onCancel={onCancel}
      onDiscard={onDiscard}
      onLanded={onLanded}
    >
      {(form) => (
        <>
          <TextInput label="Name" key={form.key('name')} {...form.getInputProps('name')} />
          <Textarea
            label="Notes"
            minRows={3}
            key={form.key('notes')}
            {...form.getInputProps('notes')}
          />
        </>
      )}
    </RecordForm>
  )
}
