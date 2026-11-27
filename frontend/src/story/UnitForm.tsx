// A Narrative Unit as structure: its text, where it sits, and the units inside
// it. Prose is shown and is not part of the draft, so a save cannot write it.

import { MultiSelect, Select, Text, Textarea, TextInput } from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'

import type { Committed, NarrativeUnit, Story, Write } from '../api/client'
import { subjectChoices, unitChoices } from './choices'
import { Empty, Prose, type SelectRecord } from './parts'
import { labelOf, type RecordIndex } from './records'
import { OrderedIdList } from './OrderedIdList'
import { RecordForm } from './RecordForm'
import {
  createUnitWrites,
  currentPosition,
  descendantIds,
  moveUnitWrites,
  ownerByParent,
  placementChoices,
  unitOwner,
} from './units'
import { recordUpdate } from './writes'

export type UnitDraft = {
  title: string
  summary: string
  notes: string
  subject_ids: string[]
  child_ids: string[]
  /** `story`, or the id of the unit this one sits inside. */
  parentId: string
  /** The index in that parent's list, as a string for the select. */
  position: string
}

export function UnitForm({
  heading,
  unit,
  parentId,
  prose,
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
  unit?: NarrativeUnit
  /** Where a create starts. Defaults to the story. */
  parentId?: string
  prose?: string
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
  const initialValues = unit ? draftFromUnit(story, unit) : emptyDraft(story, parentId ?? 'story')
  return (
    <RecordForm
      heading={heading}
      recordId={unit?.id ?? null}
      goneId={unit ? unit.id : undefined}
      initialValues={initialValues}
      buildWrites={(draft) => unitWrites(story, draft, unit)}
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
        <UnitFields form={form} story={story} index={index} selfId={unit?.id ?? null} prose={prose ?? ''} />
      )}
    </RecordForm>
  )
}

function UnitFields({
  form,
  story,
  index,
  selfId,
  prose,
}: {
  form: UseFormReturnType<UnitDraft>
  story: Story
  index: RecordIndex
  selfId: string | null
  prose: string
}) {
  const parentId = form.useWatchValue('parentId')
  const except = new Set<string>()
  if (selfId) {
    except.add(selfId)
    for (const id of descendantIds(story.units, selfId)) except.add(id)
  }
  const parents = [{ value: 'story', label: 'This story' }, ...unitChoices(story, except)]
  const owner = ownerByParent(story, parentId)
  const positions = placementChoices(owner?.ids ?? [], selfId).map((choice) => ({
    value: String(choice.position),
    label:
      choice.afterId == null ? 'At the start' : `After ${labelOf(index, choice.afterId)}`,
  }))
  const parentInput = form.getInputProps('parentId')
  const initialParent = form.getInitialValues().parentId

  return (
    <>
      <TextInput label="Title" key={form.key('title')} {...form.getInputProps('title')} />
      <Textarea
        label="Summary"
        minRows={2}
        key={form.key('summary')}
        {...form.getInputProps('summary')}
      />
      <Textarea label="Notes" minRows={2} key={form.key('notes')} {...form.getInputProps('notes')} />
      <MultiSelect
        label="Depicts"
        placeholder="None"
        data={subjectChoices(story)}
        searchable
        clearable
        hidePickedOptions
        nothingFoundMessage="No matching record"
        key={form.key('subject_ids')}
        {...form.getInputProps('subject_ids')}
      />
      <div>
        <Text fw={600} size="sm">
          Prose
        </Text>
        {prose ? <Prose>{prose}</Prose> : <Empty>No prose</Empty>}
      </div>
      <Select
        label="Inside"
        data={parents}
        searchable
        allowDeselect={false}
        nothingFoundMessage="No matching unit"
        key={form.key('parentId')}
        {...parentInput}
        onChange={(value) => {
          const next = value ?? 'story'
          parentInput.onChange(next)
          const nextOwner = ownerByParent(story, next)
          const position =
            selfId && next === initialParent
              ? currentPosition(nextOwner?.ids ?? [], selfId)
              : (nextOwner?.ids.length ?? 0)
          form.setFieldValue('position', String(position))
        }}
      />
      <Select
        label="Position"
        data={positions}
        allowDeselect={false}
        key={form.key('position')}
        {...form.getInputProps('position')}
      />
      {selfId && (
        <OrderedIdList
          label="Units inside"
          options={unitChoices(story, new Set())}
          key={form.key('child_ids')}
          {...form.getInputProps('child_ids')}
          removable={false}
        />
      )}
    </>
  )
}

function draftFromUnit(story: Story, unit: NarrativeUnit): UnitDraft {
  const owner = unitOwner(story, unit.id)
  return {
    title: unit.title,
    summary: unit.summary,
    notes: unit.notes,
    subject_ids: [...unit.subject_ids],
    child_ids: [...unit.child_ids],
    parentId: owner?.kind === 'unit' ? owner.id : 'story',
    position: String(owner ? currentPosition(owner.ids, unit.id) : 0),
  }
}

function emptyDraft(story: Story, parentId: string): UnitDraft {
  const owner = ownerByParent(story, parentId)
  return {
    title: '',
    summary: '',
    notes: '',
    subject_ids: [],
    child_ids: [],
    parentId: owner ? parentId : 'story',
    position: String(owner?.ids.length ?? 0),
  }
}

function unitWrites(story: Story, draft: UnitDraft, unit: NarrativeUnit | undefined): Write[] | null {
  const position = Number(draft.position)
  const safe = Number.isFinite(position) ? position : 0
  const to = ownerByParent(story, draft.parentId)
  if (!unit) {
    if (!to) return null
    return createUnitWrites(
      {
        title: draft.title,
        summary: draft.summary,
        notes: draft.notes,
        subject_ids: draft.subject_ids,
      },
      to,
      safe,
    )
  }
  const fields = recordUpdate('unit', unit, {
    title: draft.title,
    summary: draft.summary,
    notes: draft.notes,
    subject_ids: draft.subject_ids,
    child_ids: draft.child_ids,
  })
  const from = unitOwner(story, unit.id)
  const moves = from && to ? moveUnitWrites(unit.id, from, to, safe) : []
  const writes: Write[] = [...(fields ? [fields] : []), ...moves]
  return writes.length > 0 ? writes : null
}
