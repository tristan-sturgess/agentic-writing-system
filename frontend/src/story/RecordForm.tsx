// The save wiring every record form shares: the outcome, the field errors from
// a refusal, Save mine anyway, Retry, Save, and Cancel. A kind's form supplies
// the fields and the writes.

import { Button, CloseButton, Group, Stack, Text } from '@mantine/core'
import { useForm, type UseFormReturnType } from '@mantine/form'
import { useEffect, type ReactNode } from 'react'

import type { Committed, Write } from '../api/client'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { SaveOutcome } from './SaveOutcome'
import { useCommit, type SendResult } from './useCommit'
import { fieldProblems, recordGone } from './writes'

export function RecordForm<Draft>({
  heading,
  recordId,
  goneId,
  initialValues,
  validate,
  buildWrites,
  storyId,
  index,
  onSelect,
  onClose,
  onDirtyChange,
  onCancel,
  onDiscard,
  onLanded,
  children,
}: {
  /** Set for a create, which has no record header of its own. */
  heading?: string
  /**
   * The record an edit writes, or null for a create and for the story's
   * framing. Refusal problems for any other record are not shown on the fields.
   */
  recordId: string | null
  /**
   * The conflict row that means there is nothing left to save over. Omit it
   * for a create. Null is the story row, for the framing.
   */
  goneId?: string | null
  initialValues: Draft
  validate?: (values: Draft) => Record<string, string | null | undefined>
  /** The writes for a draft. Null, or an empty list, means the draft changes nothing. */
  buildWrites: (draft: Draft) => readonly Write[] | null
  storyId: string
  index: RecordIndex
  onSelect: SelectRecord
  onClose?: () => void
  onDirtyChange: (dirty: boolean) => void
  /** Drop the draft and show what the panel already loaded. */
  onCancel: () => void
  /** Drop the draft and load the story, so the panel shows what is stored. */
  onDiscard: () => void
  /** The commit landed. The caller reloads and leaves the form. */
  onLanded: (committed: Committed) => Promise<void>
  children: (form: UseFormReturnType<Draft>) => ReactNode
}) {
  const commit = useCommit(storyId)
  const form = useForm<Draft>({
    mode: 'uncontrolled',
    initialValues,
    validate: validate
      ? (values) => {
          const errors: Record<string, string> = {}
          for (const [field, message] of Object.entries(validate(values))) {
            if (message) errors[field] = message
          }
          return errors
        }
      : undefined,
    onValuesChange: () => commit.clearRefusal(),
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
          fieldProblems(outcome.refusal.problems, recordId).map((item) => [
            item.field,
            item.message,
          ]),
        ),
      )
    }
  }

  function discard() {
    onDirtyChange(false)
    onDiscard()
  }

  function currentWrites(): readonly Write[] | null {
    return buildWrites(form.getValues())
  }

  function overwrite() {
    const writes = currentWrites()
    if (!writes || writes.length === 0) {
      discard()
      return
    }
    void settle(commit.overwrite(writes))
  }

  function retry() {
    const writes = currentWrites()
    if (writes && writes.length > 0) void settle(commit.send(writes))
  }

  const { failure, conflict } = commit
  const gone = conflict != null && goneId !== undefined && recordGone(conflict.rows, goneId)

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        const writes = buildWrites(values)
        if (!writes || writes.length === 0) {
          onCancel()
          return
        }
        await settle(commit.send(writes))
      })}
    >
      <Stack gap="sm">
        {heading && (
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Text fw={700}>{heading}</Text>
            {onClose && <CloseButton aria-label="Close the record" onClick={onClose} />}
          </Group>
        )}
        {children(form)}
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
