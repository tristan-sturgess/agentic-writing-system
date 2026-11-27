import { MultiSelect, Select, Textarea } from '@mantine/core'

import type { Assertion, Committed, Story, Write } from '../api/client'
import { arcChoices, entityChoices, eventChoices } from './choices'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { RecordForm } from './RecordForm'
import { spanDrafts, spansFromDrafts, type SpanDraft } from './spanForm'
import { SpanListEditor } from './SpanListEditor'
import { assertionCreate, recordUpdate } from './writes'

export type AssertionDraft = {
  statement: string
  entity_ids: string[]
  event_ids: string[]
  arc_ids: string[]
  when: SpanDraft[]
  caused_by: string | null
}

export function AssertionForm({
  heading,
  assertion,
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
  assertion?: Assertion
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
  const initialValues: AssertionDraft = assertion
    ? {
        statement: assertion.statement,
        entity_ids: [...assertion.entity_ids],
        event_ids: [...assertion.event_ids],
        arc_ids: [...assertion.arc_ids],
        when: spanDrafts(assertion.when),
        caused_by: assertion.caused_by,
      }
    : {
        statement: '',
        entity_ids: [],
        event_ids: [],
        arc_ids: [],
        when: [],
        caused_by: null,
      }
  return (
    <RecordForm
      heading={heading}
      recordId={assertion?.id ?? null}
      goneId={assertion ? assertion.id : undefined}
      initialValues={initialValues}
      validate={(values) => ({ when: whenError(values.when) })}
      buildWrites={(draft) => assertionWrites(draft, assertion)}
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
          <Textarea
            label="Statement"
            minRows={2}
            key={form.key('statement')}
            {...form.getInputProps('statement')}
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
          <MultiSelect
            label="Events"
            placeholder="None"
            data={eventChoices(story)}
            searchable
            clearable
            hidePickedOptions
            nothingFoundMessage="No matching Event"
            key={form.key('event_ids')}
            {...form.getInputProps('event_ids')}
          />
          <MultiSelect
            label="Arcs"
            placeholder="None"
            data={arcChoices(story)}
            searchable
            clearable
            hidePickedOptions
            nothingFoundMessage="No matching Arc"
            key={form.key('arc_ids')}
            {...form.getInputProps('arc_ids')}
          />
          <SpanListEditor
            events={eventChoices(story)}
            key={form.key('when')}
            {...form.getInputProps('when')}
          />
          <Select
            label="Caused by"
            placeholder="No Event"
            data={eventChoices(story)}
            searchable
            clearable
            nothingFoundMessage="No matching Event"
            key={form.key('caused_by')}
            {...form.getInputProps('caused_by')}
          />
        </>
      )}
    </RecordForm>
  )
}

function assertionWrites(draft: AssertionDraft, assertion: Assertion | undefined): Write[] | null {
  const when = spansFromDrafts(draft.when)
  if ('error' in when) return null
  const fields = {
    statement: draft.statement,
    entity_ids: draft.entity_ids,
    event_ids: draft.event_ids,
    arc_ids: draft.arc_ids,
    when: when.spans,
    caused_by: draft.caused_by || null,
  }
  if (assertion) {
    const write = recordUpdate('assertion', assertion, fields)
    return write ? [write] : null
  }
  return [assertionCreate(fields)]
}

function whenError(when: SpanDraft[]): string | null {
  const converted = spansFromDrafts(when)
  return 'error' in converted ? converted.error : null
}
