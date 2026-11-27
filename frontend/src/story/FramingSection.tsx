// The story's framing. It is not a record in the detail panel: Edit, Save, and
// the same outcomes live on this tab, and the commit is a `set_story`.

import { Button, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useState } from 'react'

import type { Story } from '../api/client'
import { Empty, Prose, type SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { RecordForm } from './RecordForm'
import { framingUpdate, type FramingDraft } from './writes'

const FIELDS = [
  ['description', 'Description'],
  ['premise', 'Premise'],
  ['tone', 'Tone'],
  ['themes', 'Themes'],
  ['writing_style', 'Writing style'],
] as const

export function FramingSection({
  story,
  index,
  onSelect,
  onReload,
  onDirtyChange,
}: {
  story: Story
  index: RecordIndex
  onSelect: SelectRecord
  onReload: () => Promise<void>
  onDirtyChange: (dirty: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <Stack gap="md">
        <div>
          <Button type="button" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <Field label="Title" value={story.title} empty="Untitled" />
        {FIELDS.map(([field, label]) => (
          <Field key={field} label={label} value={story[field]} empty="Not set" />
        ))}
      </Stack>
    )
  }
  const initialValues: FramingDraft = {
    title: story.title,
    description: story.description,
    premise: story.premise,
    tone: story.tone,
    themes: story.themes,
    writing_style: story.writing_style,
  }
  return (
    <RecordForm
      recordId={null}
      goneId={null}
      initialValues={initialValues}
      buildWrites={(draft) => {
        const write = framingUpdate(story, draft)
        return write ? [write] : null
      }}
      storyId={story.id}
      index={index}
      onSelect={onSelect}
      onDirtyChange={onDirtyChange}
      onCancel={() => setEditing(false)}
      onDiscard={() => {
        setEditing(false)
        void onReload()
      }}
      onLanded={async () => {
        await onReload()
        setEditing(false)
      }}
    >
      {(form) => (
        <>
          <TextInput label="Title" key={form.key('title')} {...form.getInputProps('title')} />
          {FIELDS.map(([field, label]) => (
            <Textarea
              key={form.key(field)}
              label={label}
              minRows={2}
              {...form.getInputProps(field)}
            />
          ))}
        </>
      )}
    </RecordForm>
  )
}

function Field({ label, value, empty }: { label: string; value: string; empty: string }) {
  return (
    <div>
      <Text fw={600} size="sm">
        {label}
      </Text>
      {value ? <Prose>{value}</Prose> : <Empty>{empty}</Empty>}
    </div>
  )
}
