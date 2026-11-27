// Confirmation for undoing one commit, and what a failed revert shows.
// A conflict has no "anyway": the revert does not force the story back.

import { Button, Group, Stack, Text } from '@mantine/core'
import { useState, type ReactNode } from 'react'

import { describeFailure, postRevert } from '../api/client'
import type { SelectRecord } from '../story/parts'
import type { RecordIndex } from '../story/records'
import { SaveOutcome, type SaveFailure } from '../story/SaveOutcome'

export function RevertCommit({
  storyId,
  commitId,
  index,
  onSelect,
  onReverted,
  header,
}: {
  storyId: string
  commitId: string
  index: RecordIndex
  onSelect: SelectRecord
  /** The story and the history load again after the revert lands. */
  onReverted: () => Promise<void>
  /** The commit's time, source, and undone mark, shown beside the button. */
  header: ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<SaveFailure | null>(null)

  async function send() {
    setPending(true)
    setFailure(null)
    try {
      const outcome = await postRevert(storyId, [commitId])
      if (outcome.status === 'committed') {
        setConfirming(false)
        await onReverted()
        return
      }
      setFailure(outcome)
    } catch (error) {
      const reason = error instanceof Error ? error : new Error(String(error))
      setFailure({ status: 'error', message: describeFailure(reason) })
    } finally {
      setPending(false)
    }
  }

  return (
    <Stack gap={4}>
      <Group gap="xs" justify="space-between" align="flex-start" wrap="nowrap">
        {header}
        {!confirming && (
          <Button type="button" variant="default" size="xs" onClick={() => setConfirming(true)}>
            Revert
          </Button>
        )}
      </Group>
      {confirming && (
        <Stack gap="xs">
          <Text size="sm">Revert this commit?</Text>
          {failure && (
            <SaveOutcome
              failure={failure}
              index={index}
              onSelect={onSelect}
              onRetry={failure.status === 'busy' ? () => void send() : undefined}
            />
          )}
          <Group gap="xs" wrap="wrap">
            <Button type="button" size="xs" loading={pending} onClick={() => void send()}>
              Revert
            </Button>
            <Button
              type="button"
              variant="default"
              size="xs"
              disabled={pending}
              onClick={() => {
                setConfirming(false)
                setFailure(null)
              }}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  )
}
