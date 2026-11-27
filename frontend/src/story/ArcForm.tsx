import { Textarea, TextInput } from '@mantine/core'

import type { Arc, Committed, Story, Write } from '../api/client'
import { eventChoices } from './choices'
import { OrderedIdList } from './OrderedIdList'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { RecordForm } from './RecordForm'
import { arcCreate, recordUpdate } from './writes'

export type ArcDraft = {
  title: string
  description: string
  event_ids: string[]
}

export function ArcForm({
  heading,
  arc,
  story,
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
  arc?: Arc
  story: Story
  storyId: string
  index: RecordIndex
  onSelect: SelectRecord
  onClose?: () => void
  onDirtyChange: (dirty: boolean) => void
  onCancel: () => void
  onDiscard: () => void
  onLanded: (committed: Committed) => Promise<void>
}) {
  const initialValues: ArcDraft = arc
    ? {
        title: arc.title,
        description: arc.description,
        event_ids: [...arc.event_ids],
      }
    : { title: '', description: '', event_ids: [] }
  return (
    <RecordForm
      heading={heading}
      recordId={arc?.id ?? null}
      goneId={arc ? arc.id : undefined}
      initialValues={initialValues}
      buildWrites={(draft) => arcWrites(draft, arc)}
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
          <TextInput label="Title" key={form.key('title')} {...form.getInputProps('title')} />
          <Textarea
            label="Description"
            minRows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />
          <OrderedIdList
            label="Events"
            options={eventChoices(story)}
            addLabel="Add an Event"
            key={form.key('event_ids')}
            {...form.getInputProps('event_ids')}
          />
        </>
      )}
    </RecordForm>
  )
}

function arcWrites(draft: ArcDraft, arc: Arc | undefined): Write[] | null {
  const fields = {
    title: draft.title,
    description: draft.description,
    event_ids: draft.event_ids,
  }
  if (arc) {
    const write = recordUpdate('arc', arc, fields)
    return write ? [write] : null
  }
  return [arcCreate(fields)]
}
