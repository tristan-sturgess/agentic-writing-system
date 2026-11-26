// The small pieces every section of the story view shares.

import { Anchor, Badge, Group, Stack, Text } from '@mantine/core'
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

/** Selects a record, which opens it in the detail panel. */
export type SelectRecord = (id: string) => void

/**
 * A record's primary text, or the text of a record it names.
 * With `onSelect` it is a button that selects that record.
 */
export function RecordLink({
  id,
  onSelect,
  children,
  fw,
}: {
  id: string
  onSelect?: SelectRecord
  children: ReactNode
  fw?: number
}) {
  if (!onSelect) {
    return (
      <Text span fw={fw}>
        {children}
      </Text>
    )
  }
  return (
    <Anchor component="button" type="button" fw={fw} ta="left" onClick={() => onSelect(id)}>
      {children}
    </Anchor>
  )
}

/** A record's id, shown small beside its name. Refusals and agents speak in ids. */
export function RecordId({ id }: { id: string }) {
  return (
    <Text span size="xs" c="dimmed" ff="monospace" style={{ overflowWrap: 'anywhere' }}>
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
export function RecordRefs({
  ids,
  index,
  onSelect,
}: {
  ids: string[]
  index: RecordIndex
  onSelect?: SelectRecord
}) {
  if (ids.length === 0) {
    return <Empty>None</Empty>
  }
  return (
    <Group gap={6}>
      {ids.map((id) => {
        const badge = (
          <Badge
            key={id}
            variant="light"
            color={KIND_COLORS[index.get(id)?.kind ?? 'property']}
            tt="none"
            title={id}
          >
            {labelOf(index, id)}
          </Badge>
        )
        if (!onSelect) return badge
        return (
          <Badge
            key={id}
            component="button"
            type="button"
            variant="light"
            color={KIND_COLORS[index.get(id)?.kind ?? 'property']}
            tt="none"
            title={id}
            onClick={() => onSelect(id)}
            style={{ cursor: 'pointer' }}
          >
            {labelOf(index, id)}
          </Badge>
        )
      })}
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

/** The `caused_by` of a Property or an Assertion, when set. */
export function StatementLinks({
  causedBy,
  index,
  onSelect,
}: {
  causedBy: string | null
  index: RecordIndex
  onSelect?: SelectRecord
}) {
  if (causedBy === null) {
    return null
  }
  return (
    <Text size="sm" c="dimmed">
      Caused by:{' '}
      <RecordLink id={causedBy} onSelect={onSelect}>
        {labelOf(index, causedBy)}
      </RecordLink>
    </Text>
  )
}
