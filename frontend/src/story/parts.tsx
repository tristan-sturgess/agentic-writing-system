// The small pieces every section of the story view shares.

import { Badge, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

import type { Span } from '../api/client'
import { labelOf, type RecordIndex, type RecordKind } from './records'
import { describeSpan } from './when'

const KIND_COLORS: Record<RecordKind, string> = {
  entity: 'blue',
  event: 'orange',
  arc: 'grape',
  unit: 'teal',
  property: 'gray',
  assertion: 'gray',
}

/** A record's id, shown small beside its name. Refusals and agents speak in ids. */
export function RecordId({ id }: { id: string }) {
  return (
    <Text span size="xs" c="dimmed" ff="monospace">
      {id}
    </Text>
  )
}

/** Text the writer typed, with its line breaks kept. */
export function Prose({ children }: { children: string }) {
  return <Text style={{ whiteSpace: 'pre-wrap' }}>{children}</Text>
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Text c="dimmed" size="sm">
      {children}
    </Text>
  )
}

/** Records named by id, each shown as its label and colored by its kind. */
export function RecordRefs({ ids, index }: { ids: string[]; index: RecordIndex }) {
  if (ids.length === 0) {
    return <Empty>None</Empty>
  }
  return (
    <Group gap={6}>
      {ids.map((id) => (
        <Badge
          key={id}
          variant="light"
          color={KIND_COLORS[index.get(id)?.kind ?? 'property']}
          tt="none"
          title={id}
        >
          {labelOf(index, id)}
        </Badge>
      ))}
    </Group>
  )
}

/** A `when` list, one span to a line. `empty` says what an empty list means here. */
export function When({
  spans,
  index,
  empty,
}: {
  spans: Span[]
  index: RecordIndex
  empty: string
}) {
  if (spans.length === 0) {
    return <Empty>{empty}</Empty>
  }
  return (
    <Stack gap={0}>
      {spans.map((span, position) => (
        <Text key={position} size="sm">
          {describeSpan(span, (id) => labelOf(index, id))}
        </Text>
      ))}
    </Stack>
  )
}

/** The `caused_by` and `supersedes` of a Property or an Assertion, when set. */
export function StatementLinks({
  causedBy,
  supersedes,
  index,
}: {
  causedBy: string | null
  supersedes: string | null
  index: RecordIndex
}) {
  if (causedBy === null && supersedes === null) {
    return null
  }
  return (
    <Stack gap={0}>
      {causedBy !== null && (
        <Text size="sm" c="dimmed">
          Caused by: {labelOf(index, causedBy)}
        </Text>
      )}
      {supersedes !== null && (
        <Text size="sm" c="dimmed">
          Supersedes: {labelOf(index, supersedes)}
        </Text>
      )}
    </Stack>
  )
}
