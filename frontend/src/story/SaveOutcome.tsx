// What a failed save shows: the refusal, the rows a conflict lists, or a busy error.

import { Alert, Button, Group, Stack, Text } from '@mantine/core'

import type { ConflictResponse, ConflictRowView, Refusal } from '../api/client'
import { labelOf, type RecordIndex } from './records'
import { RecordLink, type SelectRecord } from './parts'
import { conflictRowIsGone, conflictRowLabel, problemMessage } from './writes'

export type SaveFailure =
  | { status: 'refused'; refusal: Refusal }
  | { status: 'conflict'; conflict: ConflictResponse }
  | { status: 'busy'; message: string }
  | { status: 'error'; message: string }

const FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  notes: 'Notes',
  title: 'Title',
  statement: 'Statement',
  description: 'Description',
  premise: 'Premise',
  tone: 'Tone',
  themes: 'Themes',
  writing_style: 'Writing style',
  entity_id: 'Entity',
  entity_ids: 'Entities',
  event_ids: 'Events',
  arc_ids: 'Arcs',
  caused_by: 'Caused by',
  when: 'When',
  child_ids: 'Units inside',
  subject_ids: 'Depicts',
  unit_ids: 'In the story',
}

/**
 * The refusal, conflict, or busy error from a save.
 * The buttons are the actions that outcome has. A refusal has none of them:
 * the form keeps Save and Cancel, and the problems sit on the fields.
 */
export function SaveOutcome({
  failure,
  index,
  onSelect,
  onOverwrite,
  overwriteLabel,
  onDiscard,
  discardLabel,
  onRetry,
}: {
  failure: SaveFailure
  index: RecordIndex
  onSelect: SelectRecord
  onOverwrite?: () => void
  overwriteLabel?: string
  onDiscard?: () => void
  discardLabel?: string
  onRetry?: () => void
}) {
  return (
    <Stack gap="xs">
      {failure.status === 'refused' && (
        <RefusalAlert refusal={failure.refusal} index={index} onSelect={onSelect} />
      )}
      {failure.status === 'conflict' && <ConflictAlert rows={failure.conflict.rows} index={index} />}
      {failure.status === 'busy' && (
        <Alert color="yellow" title="The story is busy">
          {failure.message}
        </Alert>
      )}
      {failure.status === 'error' && (
        <Alert color="red" title="The story could not be saved">
          {failure.message}
        </Alert>
      )}
      {(onOverwrite || onDiscard || onRetry) && (
        <Group gap="xs" wrap="wrap">
          {onOverwrite && overwriteLabel && (
            <Button type="button" onClick={onOverwrite}>
              {overwriteLabel}
            </Button>
          )}
          {onRetry && failure.status === 'busy' && (
            <Button type="button" onClick={onRetry}>
              Retry
            </Button>
          )}
          {onDiscard && discardLabel && (
            <Button type="button" variant="default" onClick={onDiscard}>
              {discardLabel}
            </Button>
          )}
        </Group>
      )}
    </Stack>
  )
}

function RefusalAlert({
  refusal,
  index,
  onSelect,
}: {
  refusal: Refusal
  index: RecordIndex
  onSelect: SelectRecord
}) {
  const extra = [
    ...new Set(
      refusal.problems
        .map(problemMessage)
        .filter((message) => message !== refusal.message),
    ),
  ]
  const referring = [
    ...new Set(refusal.problems.flatMap((problem) => problem.referring)),
  ]
  return (
    <Alert color="red" title="The story refused this save">
      <Text size="sm">{refusal.message}</Text>
      {extra.map((message) => (
        <Text key={message} size="sm" mt={4}>
          {message}
        </Text>
      ))}
      {referring.length > 0 && (
        <Stack gap={4} mt="xs">
          <Text size="xs" c="dimmed">
            Referring records
          </Text>
          {referring.map((id) =>
            id === 'story' ? (
              <Text key={id} size="sm">
                This story
              </Text>
            ) : (
              <RecordLink key={id} id={id} onSelect={onSelect}>
                {labelOf(index, id)}
              </RecordLink>
            ),
          )}
        </Stack>
      )}
    </Alert>
  )
}

function ConflictAlert({ rows, index }: { rows: ConflictRowView[]; index: RecordIndex }) {
  return (
    <Alert color="yellow" title="This story changed before the save">
      <Stack gap="sm">
        {rows.map((row, position) => {
          const gone = conflictRowIsGone(row)
          const title =
            conflictRowLabel(row) ?? (row.id ? labelOf(index, row.id) : 'This story')
          return (
            <div key={`${row.id ?? 'story'}-${position}`}>
              <Text size="sm" fw={600}>
                {title}
                {gone ? ' — gone' : ''}
              </Text>
              {!gone && row.fields && <FieldList fields={row.fields} index={index} />}
            </div>
          )
        })}
      </Stack>
    </Alert>
  )
}

function FieldList({
  fields,
  index,
}: {
  fields: { [key: string]: unknown }
  index: RecordIndex
}) {
  return (
    <Stack gap={2}>
      {Object.entries(fields).map(([key, value]) => (
        <Text key={key} size="sm">
          {FIELD_LABEL[key] ?? key}: {formatFieldValue(value, index)}
        </Text>
      ))}
    </Stack>
  )
}

function formatFieldValue(value: unknown, index: RecordIndex): string {
  if (value == null) return 'none'
  if (typeof value === 'string') {
    if (value === '') return 'empty'
    return index.has(value) ? labelOf(index, value) : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    if (value.length === 0) return 'none'
    return value.map((item) => (index.has(item) ? labelOf(index, item) : item)).join(', ')
  }
  return JSON.stringify(value)
}
