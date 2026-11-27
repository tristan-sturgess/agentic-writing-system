// The story's commits, newest first. This view loads the history itself.
// A save loads the story again, and `updated_at` moves, so the history loads with it.

import { Alert, Badge, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { useCallback, useMemo, useState } from 'react'

import { describeFailure, getHistory, type ChangeView, type CommitView } from '../api/client'
import { useStory } from '../pages/storyContext'
import { fieldLabel } from '../story/fieldLabels'
import { formatFieldValue } from '../story/formatFieldValue'
import { Empty, RecordLink } from '../story/parts'
import { indexRecords, type RecordIndex } from '../story/records'
import { useLoad } from '../useLoad'
import { changedFields, changeLabel, revertedBy } from './changes'
import { RevertCommit } from './RevertCommit'

const SOURCE_LABEL: Record<CommitView['source'], string> = {
  user: 'Hand edit',
  import: 'Import',
  revert: 'Revert',
  tool: 'Tool',
  draft: 'Draft',
  eval: 'Evaluation',
}

const KIND_LABEL: Record<string, string> = {
  entity: 'Entity',
  property: 'Property',
  assertion: 'Assertion',
  event: 'Event',
  unit: 'Narrative Unit',
  arc: 'Arc',
}

const VERB: Record<ChangeView['op'], string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

/** What changed in this story, when, and from where, and what one commit changed. */
export function HistoryView() {
  const outlet = useStory()
  const story = outlet?.story
  const storyId = story?.id ?? ''
  const updatedAt = story?.updated_at ?? ''
  const load = useCallback((): Promise<CommitView[]> => {
    // The layout renders this view before the story has loaded. There is
    // nothing to ask for until a story exists. `updatedAt` is part of the
    // load so an edit, which changes it, fetches the history again.
    if (storyId === '' || updatedAt === '') return Promise.resolve([])
    return getHistory(storyId)
  }, [storyId, updatedAt])
  const history = useLoad(load)
  const index = useMemo(() => (story ? indexRecords(story) : null), [story])
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())

  if (!outlet || !story || !index) return null
  if (history.status === 'loading') return <Loader />
  if (history.status === 'failed') {
    return (
      <Alert color="red" title="The history could not be loaded">
        {describeFailure(history.error)}
      </Alert>
    )
  }

  const commits = history.data
  if (commits.length === 0) {
    return <Empty>Nothing has changed in this story yet.</Empty>
  }

  const undone = revertedBy(commits)
  const toggle = (key: string) => {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Stack gap="lg">
      {commits.map((commit) => (
        <Stack key={commit.commit_id} gap={4}>
          <RevertCommit
            storyId={storyId}
            commitId={commit.commit_id}
            index={index}
            onSelect={outlet.selectRecord}
            onReverted={outlet.reload}
            header={
              <Group gap="xs">
                <Text size="sm" fw={600}>
                  {commitTime(commit.committed_at)}
                </Text>
                <Text size="sm" c="dimmed">
                  {SOURCE_LABEL[commit.source]}
                </Text>
                {undone.has(commit.commit_id) && (
                  <Badge variant="light" color="gray">
                    Undone
                  </Badge>
                )}
              </Group>
            }
          />
          {commit.changes.map((change, position) => {
            const key = `${commit.commit_id}:${position}`
            return (
              <ChangeRow
                key={key}
                change={change}
                index={index}
                onSelect={outlet.selectRecord}
                open={open.has(key)}
                onToggle={() => toggle(key)}
              />
            )
          })}
        </Stack>
      ))}
    </Stack>
  )
}

function commitTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function ChangeRow({
  change,
  index,
  onSelect,
  open,
  onToggle,
}: {
  change: ChangeView
  index: RecordIndex
  onSelect: (id: string) => void
  open: boolean
  onToggle: () => void
}) {
  const fields = changedFields(change.before, change.after).filter(
    (key) =>
      formatFieldValue(change.before?.[key], index) !==
      formatFieldValue(change.after?.[key], index),
  )
  const name = changeLabel(change)
  const exists = change.record_id != null && index.has(change.record_id)
  return (
    <Stack gap={2}>
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <Text size="sm" style={{ flex: '1 1 auto' }}>
          <ChangeSummary change={change} name={name} exists={exists} onSelect={onSelect} />
        </Text>
        {fields.length > 0 && (
          <Button type="button" variant="default" size="xs" onClick={onToggle}>
            {open ? 'Hide fields' : 'Fields'}
          </Button>
        )}
      </Group>
      {open && (
        <Stack gap={2} pl="md">
          {fields.map((key) => (
            <Text key={key} size="sm">
              {fieldLabel(key)}: {formatFieldValue(change.before?.[key], index)} →{' '}
              {formatFieldValue(change.after?.[key], index)}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function ChangeSummary({
  change,
  name,
  exists,
  onSelect,
}: {
  change: ChangeView
  name: string | null
  exists: boolean
  onSelect: (id: string) => void
}) {
  const verb = VERB[change.op]
  if (change.kind === 'story') {
    return name ? `${verb} the story “${name}”` : `${verb} the story`
  }
  const kind = KIND_LABEL[change.kind] ?? change.kind
  const shown = name ?? change.record_id ?? ''
  return (
    <>
      {verb} {kind}{' '}
      {exists && change.record_id ? (
        <RecordLink id={change.record_id} onSelect={onSelect}>
          {shown}
        </RecordLink>
      ) : (
        shown
      )}
    </>
  )
}
