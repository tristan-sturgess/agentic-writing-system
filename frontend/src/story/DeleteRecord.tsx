// The confirmation for deleting one record, and what a failed delete shows.
// The writes are the whole commit: a Narrative Unit's delete also updates the
// list that holds it.

import { Button, Group, Stack, Text } from '@mantine/core'

import type { Write } from '../api/client'
import type { SelectRecord } from './parts'
import type { RecordIndex } from './records'
import { SaveOutcome } from './SaveOutcome'
import { useCommit } from './useCommit'
import { recordGone } from './writes'

export function DeleteRecord({
  writes,
  recordId,
  prompt,
  storyId,
  index,
  onSelect,
  onCancel,
  onReload,
  onDeleted,
}: {
  /** The commit that deletes the record, at the revisions the panel loaded. */
  writes: readonly Write[]
  /** The record being deleted. When a conflict marks it gone, only Cancel remains. */
  recordId: string
  /** The question the confirmation asks, including what goes with the record. */
  prompt: string
  storyId: string
  index: RecordIndex
  onSelect: SelectRecord
  onCancel: () => void
  onReload: () => Promise<void>
  onDeleted: () => Promise<void>
}) {
  const commit = useCommit(storyId)

  async function settle(sent: ReturnType<typeof commit.send> | null) {
    if (!sent) return
    const outcome = await sent
    if (outcome.status === 'committed') await onDeleted()
  }

  const { failure, conflict, pending } = commit
  const gone = conflict != null && recordGone(conflict.rows, recordId)
  const showDelete = failure == null || failure.status === 'refused' || failure.status === 'error'

  return (
    <Stack gap="sm">
      <Text size="sm">{prompt}</Text>
      {failure && (
        <SaveOutcome
          failure={failure}
          index={index}
          onSelect={onSelect}
          onOverwrite={conflict && !gone ? () => void settle(commit.overwrite(writes)) : undefined}
          overwriteLabel="Delete anyway"
          onDiscard={
            conflict
              ? () => {
                  onCancel()
                  void onReload()
                }
              : undefined
          }
          discardLabel="Cancel"
          onRetry={failure.status === 'busy' ? () => void settle(commit.send(writes)) : undefined}
        />
      )}
      {showDelete && (
        <Group gap="xs" wrap="wrap">
          <Button
            type="button"
            color="red"
            loading={pending}
            onClick={() => void settle(commit.send(writes))}
          >
            Delete
          </Button>
          <Button type="button" variant="default" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        </Group>
      )}
      {failure?.status === 'busy' && (
        <Button type="button" variant="default" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </Stack>
  )
}
