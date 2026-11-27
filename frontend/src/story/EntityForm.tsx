// The Entity form: a create, or an edit of name and notes. The commit's outcome
// stays on the form, and the draft stays until the save lands or the writer
// drops it.

import { Button, CloseButton, Group, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'

import type { Committed, Write } from '../api/client'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { SaveOutcome } from './SaveOutcome'
import { useCommit, type SendResult } from './useCommit'
import { fieldProblems, recordGone, type EntityDraft } from './writes'

export function EntityForm({
  heading,
  recordId,
  initialValues,
  buildWrite,
  storyId,
  index,
  onSelect,
  onClose,
  onDirtyChange,
  onCancel,
  onDiscard,
  onLanded,
}: {
  /** Set for a create, which has no record header of its own. */
  heading?: string
  /** The record an edit writes. A create has none, so a conflict cannot mean it is gone. */
  recordId: string | null
  initialValues: EntityDraft
  /**
   * The write for a draft. An edit builds it against the record as it was when
   * editing began, so a reload under the form cannot move the edit onto a newer
   * revision without a conflict.
   */
  buildWrite: (draft: EntityDraft) => Write | null
  storyId: string
  index: RecordIndex
  onSelect: SelectRecord
  onClose?: () => void
  onDirtyChange: (dirty: boolean) => void
  /** Drop the draft and show the record the panel already loaded. */
  onCancel: () => void
  /** Drop the draft and load the story, so the panel shows what is stored. */
  onDiscard: () => void
  /** The commit landed. The caller reloads and leaves the form. */
  onLanded: (committed: Committed) => Promise<void>
}) {
  const commit = useCommit(storyId)
  const form = useForm<EntityDraft>({
    mode: 'uncontrolled',
    initialValues,
    onValuesChange: commit.clearRefusal,
    enhanceGetInputProps: () => ({ disabled: commit.pending }),
  })
  const unsaved = form.isDirty()
  useEffect(() => {
    onDirtyChange(unsaved)
    return () => onDirtyChange(false)
  }, [unsaved, onDirtyChange])

  async function settle(sent: Promise<SendResult> | null) {
    if (!sent) return
    form.clearErrors()
    const outcome = await sent
    if (outcome.status === 'committed') {
      onDirtyChange(false)
      await onLanded(outcome.result)
      return
    }
    if (outcome.status === 'refused') {
      form.setErrors(
        Object.fromEntries(
          fieldProblems(outcome.refusal.problems).map((item) => [item.field, item.message]),
        ),
      )
    }
  }

  function discard() {
    onDirtyChange(false)
    onDiscard()
  }

  function currentWrite(): Write | null {
    return buildWrite(form.getValues())
  }

  function overwrite() {
    const write = currentWrite()
    if (!write) {
      discard()
      return
    }
    void settle(commit.overwrite([write]))
  }

  function retry() {
    const write = currentWrite()
    if (write) void settle(commit.send([write]))
  }

  const { failure, conflict } = commit
  const gone = recordId != null && conflict != null && recordGone(conflict.rows, recordId)

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        const write = buildWrite(values)
        if (!write) {
          onCancel()
          return
        }
        await settle(commit.send([write]))
      })}
    >
      <Stack gap="sm">
        {heading && (
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Text fw={700}>{heading}</Text>
            {onClose && <CloseButton aria-label="Close the record" onClick={onClose} />}
          </Group>
        )}
        <TextInput label="Name" key={form.key('name')} {...form.getInputProps('name')} />
        <Textarea label="Notes" minRows={3} key={form.key('notes')} {...form.getInputProps('notes')} />
        {failure && (
          <SaveOutcome
            failure={failure}
            index={index}
            onSelect={onSelect}
            onOverwrite={conflict && !gone ? overwrite : undefined}
            overwriteLabel="Save mine anyway"
            onDiscard={conflict ? discard : undefined}
            discardLabel="Discard mine"
            onRetry={failure.status === 'busy' ? retry : undefined}
          />
        )}
        {!conflict && (
          <Group gap="xs" wrap="wrap">
            <Button type="submit" loading={commit.pending}>
              Save
            </Button>
            <Button type="button" variant="default" onClick={onCancel} disabled={commit.pending}>
              Cancel
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  )
}
