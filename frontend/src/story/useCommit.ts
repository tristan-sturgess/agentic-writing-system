// Sending a save and holding its outcome. Every form and every delete in the
// detail panel saves through this, so each outcome is handled one way.

import { useCallback, useState } from 'react'

import { describeFailure, postCommit, type Committed, type Write } from '../api/client'
import type { SaveFailure } from './SaveOutcome'
import { writesWithCurrentRevisions } from './writes'

export type SendResult = { status: 'committed'; result: Committed } | SaveFailure

export function useCommit(storyId: string) {
  const [failure, setFailure] = useState<SaveFailure | null>(null)
  const [pending, setPending] = useState(false)

  /** One commit. A failure is held until the next send or until it is cleared. */
  const send = useCallback(
    async (writes: readonly Write[]): Promise<SendResult> => {
      setPending(true)
      setFailure(null)
      try {
        const outcome = await postCommit(storyId, writes)
        if (outcome.status === 'committed') return outcome
        setFailure(outcome)
        return outcome
      } catch (error) {
        const reason = error instanceof Error ? error : new Error(String(error))
        const failed: SaveFailure = { status: 'error', message: describeFailure(reason) }
        setFailure(failed)
        return failed
      } finally {
        setPending(false)
      }
    },
    [storyId],
  )

  const conflict = failure?.status === 'conflict' ? failure.conflict : null

  /**
   * After a conflict, the same writes again over the revisions the conflict
   * reported, which is what saving over the stored record means.
   */
  const overwrite = useCallback(
    (writes: readonly Write[]): Promise<SendResult> | null => {
      if (!conflict) return null
      return send(writesWithCurrentRevisions(writes, conflict.rows))
    },
    [conflict, send],
  )

  /** Drop a refusal or an error once the writer changes the edit. A conflict stays. */
  const clearRefusal = useCallback(() => {
    setFailure((current) =>
      current?.status === 'refused' || current?.status === 'error' ? null : current,
    )
  }, [])

  return { failure, pending, conflict, send, overwrite, clearRefusal }
}
