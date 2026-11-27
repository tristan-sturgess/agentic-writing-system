import { MultiSelect, Textarea, TextInput } from '@mantine/core'

import type { Committed, Story, StoryEvent, Write } from '../api/client'
import { entityChoices, eventChoices } from './choices'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { RecordForm } from './RecordForm'
import { spanDrafts, spansFromDrafts, type SpanDraft } from './spanForm'
import { SpanListEditor } from './SpanListEditor'
import { eventCreate, recordUpdate } from './writes'

export type EventDraft = {
  title: string
  description: string
  entity_ids: string[]
  when: SpanDraft[]
}

export function EventForm({
  heading,
  event,
  initialWhen,
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
  event?: StoryEvent
  /** Spans a create starts from, such as a moment picked on the timeline. */
  initialWhen?: StoryEvent['when']
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
  const initialValues: EventDraft = event
    ? {
        title: event.title,
        description: event.description,
        entity_ids: [...event.entity_ids],
        when: spanDrafts(event.when),
      }
    : {
        title: '',
        description: '',
        entity_ids: [],
        when: spanDrafts(initialWhen ?? []),
      }
  return (
    <RecordForm
      heading={heading}
      recordId={event?.id ?? null}
      goneId={event ? event.id : undefined}
      initialValues={initialValues}
      validate={(values) => ({ when: whenError(values.when) })}
      buildWrites={(draft) => eventWrites(draft, event)}
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
          <MultiSelect
            label="Entities"
            placeholder="None"
            data={entityChoices(story)}
            searchable
            clearable
            hidePickedOptions
            nothingFoundMessage="No matching Entity"
            key={form.key('entity_ids')}
            {...form.getInputProps('entity_ids')}
          />
          <SpanListEditor
            events={eventChoices(story)}
            key={form.key('when')}
            {...form.getInputProps('when')}
          />
        </>
      )}
    </RecordForm>
  )
}

function eventWrites(draft: EventDraft, event: StoryEvent | undefined): Write[] | null {
  const when = spansFromDrafts(draft.when)
  if ('error' in when) return null
  const fields = {
    title: draft.title,
    description: draft.description,
    entity_ids: draft.entity_ids,
    when: when.spans,
  }
  if (event) {
    const write = recordUpdate('event', event, fields)
    return write ? [write] : null
  }
  return [eventCreate(fields)]
}

function whenError(when: SpanDraft[]): string | null {
  const converted = spansFromDrafts(when)
  return 'error' in converted ? converted.error : null
}
