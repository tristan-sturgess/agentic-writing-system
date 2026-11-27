// A Property's statement, when it holds, and the Event that brought it about.

import { Select, Textarea } from '@mantine/core'

import type { Committed, Property, Story, Write } from '../api/client'
import { eventChoices } from './choices'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { RecordForm } from './RecordForm'
import { spanDrafts, spansFromDrafts, type SpanDraft } from './spanForm'
import { SpanListEditor } from './SpanListEditor'
import { propertyCreate, recordUpdate } from './writes'

export type PropertyDraft = {
  statement: string
  when: SpanDraft[]
  caused_by: string | null
}

function propertyInitial(property: Property): PropertyDraft {
  return {
    statement: property.statement,
    when: spanDrafts(property.when),
    caused_by: property.caused_by,
  }
}

export function PropertyForm({
  heading,
  entityId,
  property,
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
  /** Set for a create. The Property belongs to this Entity. */
  entityId?: string
  /** Set for an edit. The write is built against this copy. */
  property?: Property
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
  const initialValues: PropertyDraft = property
    ? propertyInitial(property)
    : { statement: '', when: [], caused_by: null }
  return (
    <RecordForm
      heading={heading}
      recordId={property?.id ?? null}
      goneId={property ? property.id : undefined}
      initialValues={initialValues}
      validate={(values) => ({ when: whenError(values.when) })}
      buildWrites={(draft) => propertyWrites(draft, entityId, property)}
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

function propertyWrites(
  draft: PropertyDraft,
  entityId: string | undefined,
  property: Property | undefined,
): Write[] | null {
  const when = spansFromDrafts(draft.when)
  if ('error' in when) return null
  const fields = {
    statement: draft.statement,
    when: when.spans,
    caused_by: draft.caused_by || null,
  }
  if (property) {
    const write = recordUpdate('property', property, fields)
    return write ? [write] : null
  }
  if (!entityId) return null
  return [propertyCreate(entityId, fields)]
}

function whenError(when: SpanDraft[]): string | null {
  const converted = spansFromDrafts(when)
  return 'error' in converted ? converted.error : null
}
