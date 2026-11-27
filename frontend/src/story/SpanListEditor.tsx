// The editor for a `when` list. A span is a moment or a period. A time point
// is a timestamp or an Event, and an Event can name which end is meant.

import { Button, Group, Input, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core'
import { randomId, useUncontrolled } from '@mantine/hooks'
import type { FocusEventHandler, ReactNode } from 'react'

import type { Choice } from './choices'
import {
  emptyAt,
  emptyRange,
  impliedEdge,
  type EdgeValue,
  type PointDraft,
  type SpanDraft,
} from './spanForm'

type Bound = 'start' | 'end'

export function SpanListEditor({
  label = 'When',
  error,
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  disabled,
  events,
}: {
  label?: string
  error?: ReactNode
  value?: SpanDraft[]
  defaultValue?: SpanDraft[]
  onChange?: (value: SpanDraft[]) => void
  onFocus?: FocusEventHandler<HTMLDivElement>
  onBlur?: FocusEventHandler<HTMLDivElement>
  disabled?: boolean
  events: Choice[]
}) {
  const [spans, setSpans] = useUncontrolled({
    value,
    defaultValue,
    finalValue: [],
    onChange,
  })

  function update(next: SpanDraft[]) {
    setSpans(next)
  }

  return (
    <Input.Wrapper label={label} error={error} labelElement="div" onFocus={onFocus} onBlur={onBlur}>
      <Stack gap="xs" mt={4}>
        {spans.length === 0 && (
          <Text size="sm" c="dimmed">
            No time recorded
          </Text>
        )}
        {spans.map((span, index) => (
          <Stack key={span.key} gap="xs">
            <Group justify="space-between" align="center" wrap="nowrap">
              <SegmentedControl
                size="xs"
                value={span.kind}
                disabled={disabled}
                data={[
                  { value: 'at', label: 'Moment' },
                  { value: 'range', label: 'Period' },
                ]}
                onChange={(kind) =>
                  update(replace(spans, index, { ...span, kind: kind === 'range' ? 'range' : 'at' }))
                }
              />
              <Button
                type="button"
                variant="subtle"
                color="red"
                size="compact-xs"
                disabled={disabled}
                onClick={() => update(spans.filter((item) => item.key !== span.key))}
              >
                Remove
              </Button>
            </Group>
            {span.kind === 'at' ? (
              <PointEditor
                label="At"
                point={span.at}
                events={events}
                disabled={disabled}
                allowEmpty={false}
                bound={null}
                onChange={(at) => update(replace(spans, index, { ...span, at }))}
              />
            ) : (
              <>
                <PointEditor
                  label="From"
                  point={span.start}
                  events={events}
                  disabled={disabled}
                  allowEmpty
                  bound="start"
                  onChange={(start) => update(replace(spans, index, { ...span, start }))}
                />
                <PointEditor
                  label="Until"
                  point={span.end}
                  events={events}
                  disabled={disabled}
                  allowEmpty
                  bound="end"
                  onChange={(end) => update(replace(spans, index, { ...span, end }))}
                />
              </>
            )}
          </Stack>
        ))}
        <Group gap="xs" wrap="wrap">
          <Button
            type="button"
            variant="default"
            size="xs"
            disabled={disabled}
            onClick={() => update([...spans, emptyAt(randomId())])}
          >
            Add a moment
          </Button>
          <Button
            type="button"
            variant="default"
            size="xs"
            disabled={disabled}
            onClick={() => update([...spans, emptyRange(randomId())])}
          >
            Add a period
          </Button>
        </Group>
      </Stack>
    </Input.Wrapper>
  )
}

function PointEditor({
  label,
  point,
  events,
  disabled,
  allowEmpty,
  bound,
  onChange,
}: {
  label: string
  point: PointDraft
  events: Choice[]
  disabled?: boolean
  allowEmpty: boolean
  /** Set on a range bound, where an empty edge has a meaning. Null on a moment. */
  bound: Bound | null
  onChange: (point: PointDraft) => void
}) {
  const sources = [
    ...(allowEmpty ? [{ value: 'none', label: 'No bound' }] : []),
    { value: 'timestamp', label: 'Timestamp' },
    { value: 'event', label: 'Event' },
  ]
  const eventData = withCurrent(events, point.eventId)
  return (
    <Stack gap={4}>
      <Group grow align="flex-end" wrap="nowrap">
        <Select
          label={label}
          data={sources}
          value={point.source}
          disabled={disabled}
          allowDeselect={false}
          onChange={(source) =>
            onChange({
              ...point,
              source: source === 'event' || source === 'timestamp' ? source : 'none',
            })
          }
        />
        {point.source === 'timestamp' && (
          <TextInput
            label="Timestamp"
            placeholder="1847-03-02"
            value={point.timestamp}
            disabled={disabled}
            onChange={(event) => onChange({ ...point, timestamp: event.currentTarget.value })}
          />
        )}
        {point.source === 'event' && (
          <Select
            label="Event"
            data={eventData}
            value={point.eventId || null}
            disabled={disabled}
            searchable
            nothingFoundMessage="No matching Event"
            onChange={(eventId) => onChange({ ...point, eventId: eventId ?? '' })}
          />
        )}
      </Group>
      {point.source === 'event' && bound == null && (
        <Select
          label="Edge"
          description="A moment that names an Event has to say which end."
          data={[
            { value: 'start', label: 'Start' },
            { value: 'end', label: 'End' },
          ]}
          value={point.edge || null}
          disabled={disabled}
          placeholder="Start or end"
          onChange={(edge) => onChange({ ...point, edge: edgeValue(edge) })}
        />
      )}
      {point.source === 'event' && bound != null && (
        <Select
          label="Edge"
          description={
            point.edge === ''
              ? `With no edge, this is the ${impliedEdge(bound)} of the Event.`
              : undefined
          }
          data={[
            { value: '', label: `No edge, so the ${impliedEdge(bound)}` },
            { value: 'start', label: 'Start' },
            { value: 'end', label: 'End' },
          ]}
          value={point.edge}
          disabled={disabled}
          allowDeselect={false}
          onChange={(edge) => onChange({ ...point, edge: edgeValue(edge) })}
        />
      )}
    </Stack>
  )
}

function edgeValue(edge: string | null): EdgeValue {
  if (edge === 'start' || edge === 'end') return edge
  return ''
}

function replace(spans: SpanDraft[], index: number, next: SpanDraft): SpanDraft[] {
  return spans.map((span, position) => (position === index ? next : span))
}

function withCurrent(events: Choice[], eventId: string): Choice[] {
  if (eventId === '' || events.some((event) => event.value === eventId)) return events
  return [...events, { value: eventId, label: eventId }]
}
