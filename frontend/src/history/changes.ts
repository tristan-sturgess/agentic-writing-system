// Reading one commit's changes: the line a person sees, the fields that differ,
// and which commits a later revert undid.

import type { ChangeView, CommitView } from '../api/client'
import { primaryText } from '../story/records'
import { sameValue } from '../story/writes'

/**
 * The primary text of a change, from its after-image.
 * A delete has no after-image, so the text comes from before.
 */
export function changeLabel(change: ChangeView): string | null {
  const fields = change.op === 'delete' ? change.before : change.after
  if (fields == null) return null
  return primaryText(change.kind, fields)
}

/**
 * The fields whose values differ. Keys follow the after-image, then any key
 * that only the before-image has. A missing key and a null value are the same,
 * which is how `sameValue` reads a time point.
 */
export function changedFields(
  before: { [key: string]: unknown } | null,
  after: { [key: string]: unknown } | null,
): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const key of Object.keys(after ?? {})) {
    seen.add(key)
    if (!sameValue(after?.[key], before?.[key])) keys.push(key)
  }
  for (const key of Object.keys(before ?? {})) {
    if (seen.has(key)) continue
    if (!sameValue(before?.[key], after?.[key])) keys.push(key)
  }
  return keys
}

/**
 * Each commit a later revert undid, mapped to that revert.
 *
 * Newest first. A revert that a still-later revert undid no longer undoes
 * anything: reverting a revert puts the original commit back, so the original
 * is not marked and the first revert is.
 */
export function revertedBy(commits: readonly CommitView[]): Map<string, string> {
  const by = new Map<string, string>()
  const suppressed = new Set<string>()
  for (const commit of commits) {
    if (suppressed.has(commit.commit_id)) continue
    for (const id of commit.reverts) {
      suppressed.add(id)
      if (!by.has(id)) by.set(id, commit.commit_id)
    }
  }
  return by
}
