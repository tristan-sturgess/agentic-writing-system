import {
  Alert,
  Anchor,
  Box,
  CloseButton,
  Group,
  Loader,
  NativeSelect,
  Stack,
  Text,
  Title,
  UnstyledButton,
  type NativeSelectProps,
} from '@mantine/core'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  describeFailure,
  getEventTimes,
  type EventTimes,
  type Story,
} from '../api/client'
import { labelOf, indexRecords } from '../story/records'
import { Empty } from '../story/parts'
import { useLoad } from '../useLoad'
import { useStory } from '../pages/storyContext'
import {
  eventsLinkedByTime,
  highlightOf,
  inProgress,
  layOutTimeline,
  type Highlight,
  type InProgress,
  type Mark,
  type MarkEndpoint,
  type PlacedEvent,
  type TimeSelection,
  type TimelineLayout,
  type UnplacedEntry,
  type UnplacedReason,
} from './layout'

const LINE = 11

/** What the timeline knows about Entities and Arcs, apart from the time layout. */
type TimelineLinks = {
  highlight: Highlight | null
  participantsOf: (eventId: string) => readonly string[]
  /** Sets `?highlight=`. Null clears it. Selecting an Event does not. */
  onHighlight: (id: string | null) => void
}

/**
 * Events in story time. The service resolved the times; this draws them.
 * Selecting a moment or a stretch is view state. Selecting an Event is
 * `?record=`, the detail panel every view shares. One Entity or one Arc is
 * `?highlight=`, kept beside that selection.
 */
export function TimelineView() {
  const outlet = useStory()
  const story = outlet?.story
  const storyId = story?.id ?? ''
  const [params, setParams] = useSearchParams()
  const highlightParam = params.get('highlight')
  const load = useCallback((): Promise<EventTimes> => {
    // The layout renders this view before the story has loaded, and passes no
    // context. There is nothing to ask the service for until a story id exists.
    if (storyId === '') return Promise.resolve({ events: [] })
    return getEventTimes(storyId)
  }, [storyId])
  const times = useLoad(load)
  const [picked, setPicked] = useState<{ storyId: string; time: TimeSelection } | null>(null)
  const index = useMemo(() => (story ? indexRecords(story) : null), [story])
  const participantsOf = useCallback(
    (eventId: string) => story?.events.find((event) => event.id === eventId)?.entity_ids ?? [],
    [story],
  )
  const onHighlight = useCallback(
    (id: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('highlight', id)
        else next.delete('highlight')
        return next
      })
    },
    [setParams],
  )

  if (!outlet || !story || !index) return null
  if (times.status === 'loading') return <Loader />
  if (times.status === 'failed') {
    return (
      <Alert color="red" title="The Event times could not be loaded">
        {describeFailure(times.error)}
      </Alert>
    )
  }

  const name = (id: string) => labelOf(index, id)
  const highlight = highlightOf(story, highlightParam)
  const time = picked?.storyId === story.id ? picked.time : null
  return (
    <Timeline
      storyId={story.id}
      layout={layOutTimeline(story, times.data)}
      name={name}
      eventCount={story.events.length}
      linked={
        outlet.selectedId && story.events.some((event) => event.id === outlet.selectedId)
          ? eventsLinkedByTime(story, outlet.selectedId)
          : null
      }
      selectedId={outlet.selectedId}
      onSelect={outlet.selectRecord}
      time={time}
      onTime={(next) => {
        setPicked((current) =>
          current?.storyId === story.id && sameTime(current.time, next)
            ? null
            : { storyId: story.id, time: next },
        )
      }}
      onClearTime={() => setPicked(null)}
      options={
        story.entities.length > 0 || story.arcs.length > 0 ? highlightOptions(story, name) : null
      }
      links={{ highlight, participantsOf, onHighlight }}
    />
  )
}

function Timeline({
  storyId,
  layout,
  name,
  eventCount,
  linked,
  selectedId,
  onSelect,
  time,
  onTime,
  onClearTime,
  options,
  links,
}: {
  storyId: string
  layout: TimelineLayout
  name: (id: string) => string
  eventCount: number
  linked: ReadonlySet<string> | null
  selectedId: string | null
  onSelect: (id: string) => void
  time: TimeSelection | null
  onTime: (time: TimeSelection) => void
  onClearTime: () => void
  options: NonNullable<NativeSelectProps['data']> | null
  links: TimelineLinks
}) {
  const shown = useMemo(() => visibleIds(layout, time, linked), [layout, time, linked])
  const highlightIds = links.highlight?.eventIds ?? null
  const momentLabel = useMemo(() => {
    const labels = new Map(layout.moments.map((moment) => [moment.timestamp, moment.label]))
    return (timestamp: string) => labels.get(timestamp) ?? timestamp.replace('T', ' ')
  }, [layout.moments])

  if (eventCount === 0) return <Empty>This story has no Events.</Empty>

  return (
    <Stack gap="md">
      {options && (
        <NativeSelect
          label="Highlight"
          value={links.highlight?.id ?? ''}
          onChange={(event) => links.onHighlight(event.currentTarget.value || null)}
          data={options}
          maw={360}
        />
      )}
      <Text size="sm" c="dimmed">
        A filled mark was written as a timestamp. A hollow mark was taken from another Event.
      </Text>
      {time && (
        <TimeReading
          layout={layout}
          time={time}
          name={name}
          momentLabel={momentLabel}
          onSelect={onSelect}
          onClose={onClearTime}
          links={links}
        />
      )}
      {layout.moments.length === 0 ? (
        <Empty>No Event has a time the timeline can place.</Empty>
      ) : (
        <Chart
          key={storyId}
          layout={layout}
          name={name}
          momentLabel={momentLabel}
          selectedId={selectedId}
          linked={linked}
          shown={shown}
          highlightIds={highlightIds}
          time={time}
          onSelect={onSelect}
          onTime={onTime}
        />
      )}
      <Unplaced
        layout={layout}
        name={name}
        shown={shown}
        highlightIds={highlightIds}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </Stack>
  )
}

function TimeReading({
  layout,
  time,
  name,
  momentLabel,
  onSelect,
  onClose,
  links,
}: {
  layout: TimelineLayout
  time: TimeSelection
  name: (id: string) => string
  momentLabel: (timestamp: string) => string
  onSelect: (id: string) => void
  onClose: () => void
  links: TimelineLinks
}) {
  if (time.kind === 'moment') {
    const reading = inProgress(layout, time)
    return (
      <Box>
        <Group justify="space-between" align="center">
          <Text fw={600}>{momentLabel(time.timestamp)}</Text>
          <CloseButton aria-label="Clear the selected time" onClick={onClose} />
        </Group>
        <ReadingLists reading={reading} name={name} onSelect={onSelect} links={links} />
      </Box>
    )
  }
  const across = inProgress(layout, time)
  const before = inProgress(layout, { kind: 'moment', timestamp: time.from })
  const after = inProgress(layout, { kind: 'moment', timestamp: time.to })
  const acrossIds = new Set([
    ...across.happening,
    ...across.begunNoEnd,
    ...across.endedNoStart,
  ])
  return (
    <Box>
      <Group justify="space-between" align="center">
        <Text fw={600}>
          {`${
            layout.stretches.find((stretch) => stretch.from === time.from && stretch.to === time.to)
              ?.label ?? 'Stretch'
          }, from ${momentLabel(time.from)} to ${momentLabel(time.to)}`}
        </Text>
        <CloseButton aria-label="Clear the selected time" onClick={onClose} />
      </Group>
      <Text fw={600} size="sm" mt="xs">
        Across this stretch
      </Text>
      <ReadingLists reading={across} name={name} onSelect={onSelect} links={links} />
      <Boundary
        heading={`At ${momentLabel(time.from)}`}
        reading={before}
        skip={acrossIds}
        name={name}
        onSelect={onSelect}
        links={links}
      />
      <Boundary
        heading={`At ${momentLabel(time.to)}`}
        reading={after}
        skip={acrossIds}
        name={name}
        onSelect={onSelect}
        links={links}
      />
    </Box>
  )
}

function Boundary({
  heading,
  reading,
  skip,
  name,
  onSelect,
  links,
}: {
  heading: string
  reading: InProgress
  skip: ReadonlySet<string>
  name: (id: string) => string
  onSelect: (id: string) => void
  links: TimelineLinks
}) {
  const kept: InProgress = {
    happening: reading.happening.filter((id) => !skip.has(id)),
    begunNoEnd: reading.begunNoEnd.filter((id) => !skip.has(id)),
    endedNoStart: reading.endedNoStart.filter((id) => !skip.has(id)),
  }
  const empty =
    kept.happening.length + kept.begunNoEnd.length + kept.endedNoStart.length === 0
  return (
    <Box mt="xs">
      <Text fw={600} size="sm">
        {heading}
      </Text>
      {empty ? (
        <Empty>Nothing else is recorded at this moment.</Empty>
      ) : (
        <ReadingLists reading={kept} name={name} onSelect={onSelect} links={links} />
      )}
    </Box>
  )
}

function ReadingLists({
  reading,
  name,
  onSelect,
  links,
}: {
  reading: InProgress
  name: (id: string) => string
  onSelect: (id: string) => void
  links: TimelineLinks
}) {
  const begun = reading.begunNoEnd.filter((id) => !reading.happening.includes(id))
  const ended = reading.endedNoStart.filter((id) => !reading.happening.includes(id))
  return (
    <Stack gap="xs">
      <div>
        <Text size="sm" c="dimmed">
          In progress
        </Text>
        <EventList
          ids={reading.happening}
          name={name}
          onSelect={onSelect}
          links={links}
          empty="Nothing is recorded in progress here."
        />
      </div>
      {begun.length > 0 && (
        <div>
          <Text size="sm" c="dimmed">
            Begun, and not known to have ended
          </Text>
          <EventList ids={begun} name={name} onSelect={onSelect} links={links} empty="" />
        </div>
      )}
      {ended.length > 0 && (
        <div>
          <Text size="sm" c="dimmed">
            Not known to have started
          </Text>
          <EventList ids={ended} name={name} onSelect={onSelect} links={links} empty="" />
        </div>
      )}
    </Stack>
  )
}

function EventList({
  ids,
  name,
  onSelect,
  links,
  empty,
}: {
  ids: string[]
  name: (id: string) => string
  onSelect: (id: string) => void
  links: TimelineLinks
  empty: string
}) {
  if (ids.length === 0) return empty ? <Empty>{empty}</Empty> : null
  const highlightId = links.highlight?.id ?? null
  return (
    <Stack gap={2}>
      {ids.map((id) => (
        <Group key={id} gap={6} wrap="wrap" align="baseline">
          <Anchor
            component="button"
            type="button"
            ta="left"
            fw={links.highlight?.eventIds.has(id) ? 700 : 500}
            onClick={() => onSelect(id)}
          >
            {name(id)}
          </Anchor>
          {links.participantsOf(id).length > 0 && (
            <Text span size="sm" c="dimmed">
              with
            </Text>
          )}
          {links.participantsOf(id).map((entityId) => (
            <Anchor
              key={entityId}
              component="button"
              type="button"
              size="sm"
              c={entityId === highlightId ? 'blue' : 'dimmed'}
              fw={entityId === highlightId ? 700 : 500}
              aria-pressed={entityId === highlightId}
              onClick={() => links.onHighlight(entityId === highlightId ? null : entityId)}
            >
              {name(entityId)}
            </Anchor>
          ))}
        </Group>
      ))}
    </Stack>
  )
}

function Chart({
  layout,
  name,
  momentLabel,
  selectedId,
  linked,
  shown,
  highlightIds,
  time,
  onSelect,
  onTime,
}: {
  layout: TimelineLayout
  name: (id: string) => string
  momentLabel: (timestamp: string) => string
  selectedId: string | null
  linked: ReadonlySet<string> | null
  shown: ReadonlySet<string> | null
  highlightIds: ReadonlySet<string> | null
  time: TimeSelection | null
  onSelect: (id: string) => void
  onTime: (time: TimeSelection) => void
}) {
  const rowOf = (timestamp: string) => {
    const index = layout.moments.findIndex((moment) => moment.timestamp === timestamp)
    return index === -1 ? null : index * 2 + 1
  }
  const titleColumn = layout.laneCount + 2
  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: `max-content repeat(${layout.laneCount}, 1.5rem) minmax(12rem, 1fr)`,
        columnGap: 10,
        overflowX: 'auto',
      }}
    >
      {layout.moments.map((moment, index) => {
        const row = index * 2 + 1
        const selected = time?.kind === 'moment' && time.timestamp === moment.timestamp
        const titles = layout.placed.filter((event) => event.titleAt === moment.timestamp)
        return (
          <Box key={moment.timestamp} style={{ display: 'contents' }}>
            <UnstyledButton
              type="button"
              aria-pressed={selected}
              onClick={() => onTime({ kind: 'moment', timestamp: moment.timestamp })}
              style={{
                gridColumn: 1,
                gridRow: row,
                alignSelf: 'start',
                minHeight: 28,
                textAlign: 'right',
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 'var(--mantine-font-size-sm)',
                fontWeight: selected ? 700 : 400,
                color: selected ? 'var(--mantine-color-blue-7)' : undefined,
                background: selected ? 'var(--mantine-color-blue-light)' : undefined,
                borderRadius: 4,
                padding: '0 4px',
              }}
            >
              {moment.label}
            </UnstyledButton>
            <Stack gap={2} style={{ gridColumn: titleColumn, gridRow: row, alignSelf: 'start' }}>
              {titles.map((event) => (
                <EventHeading
                  key={event.eventId}
                  eventId={event.eventId}
                  name={name}
                  selected={event.eventId === selectedId}
                  related={linked?.has(event.eventId) ?? false}
                  dimmed={isDimmed(event.eventId, shown, highlightIds)}
                  onSelect={onSelect}
                />
              ))}
            </Stack>
          </Box>
        )
      })}
      {layout.stretches.map((stretch, index) => {
        const selected =
          time?.kind === 'stretch' && time.from === stretch.from && time.to === stretch.to
        return (
          <UnstyledButton
            key={`${stretch.from}-${stretch.to}`}
            type="button"
            aria-pressed={selected}
            onClick={() => onTime({ kind: 'stretch', from: stretch.from, to: stretch.to })}
            style={{
              gridColumn: 1,
              gridRow: index * 2 + 2,
              alignSelf: 'center',
              minHeight: 22,
              textAlign: 'right',
              fontSize: 'var(--mantine-font-size-xs)',
              color: selected ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-dimmed)',
              fontWeight: selected ? 700 : 400,
              padding: '0 4px',
            }}
          >
            {stretch.label}
          </UnstyledButton>
        )
      })}
      {layout.placed.flatMap((event) =>
        event.marks.flatMap((mark, markIndex) =>
          segments(event, mark, markIndex, rowOf).map((segment) => (
            <MarkButton
              key={segment.key}
              segment={segment}
              label={markLabel(name(event.eventId), mark, momentLabel, name)}
              color={markColor(event.eventId, selectedId, linked)}
              dimmed={isDimmed(event.eventId, shown, highlightIds)}
              onClick={() => onSelect(event.eventId)}
            />
          )),
        ),
      )}
    </Box>
  )
}

function EventHeading({
  eventId,
  name,
  selected,
  related,
  dimmed,
  onSelect,
  note,
}: {
  eventId: string
  name: (id: string) => string
  selected: boolean
  related: boolean
  dimmed: boolean
  onSelect: (id: string) => void
  note?: string
}) {
  return (
    <Group gap={6} wrap="wrap" align="baseline" style={{ opacity: dimmed ? 0.35 : 1 }}>
      <Anchor
        component="button"
        type="button"
        ta="left"
        fw={selected ? 700 : related ? 600 : 500}
        c={selected ? 'blue' : undefined}
        onClick={() => onSelect(eventId)}
      >
        {name(eventId)}
      </Anchor>
      {note && (
        <Text span size="sm" c="dimmed">
          — {note}
        </Text>
      )}
    </Group>
  )
}

type Segment = {
  key: string
  column: number
  row: number
  shape: 'point' | 'open' | 'span'
  derived: boolean
  toward?: 'after' | 'before'
  top?: 'line' | 'edge'
  bottom?: 'line' | 'edge'
}

function segments(
  event: PlacedEvent,
  mark: Mark,
  markIndex: number,
  rowOf: (timestamp: string) => number | null,
): Segment[] {
  const column = event.lane + 2
  const key = `${event.eventId}-${mark.spanIndex}-${markIndex}`
  if (mark.kind === 'point') {
    const row = rowOf(mark.at.timestamp)
    return row === null ? [] : [{ key, column, row, shape: 'point', derived: mark.at.source === 'derived' }]
  }
  if (mark.kind === 'open') {
    const row = rowOf(mark.at.timestamp)
    return row === null
      ? []
      : [{ key, column, row, shape: 'open', derived: mark.at.source === 'derived', toward: mark.toward }]
  }
  const start = rowOf(mark.start.timestamp)
  const end = rowOf(mark.end.timestamp)
  if (start === null || end === null) return []
  const derived = mark.start.source === 'derived' || mark.end.source === 'derived'
  if (start === end) return [{ key, column, row: start, shape: 'point', derived }]
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  const drawn: Segment[] = []
  for (let row = from; row <= to; row++) {
    drawn.push({
      key: `${key}-${row}`,
      column,
      row,
      shape: 'span',
      derived,
      top: row === from ? 'line' : 'edge',
      bottom: row === to ? 'line' : 'edge',
    })
  }
  return drawn
}

function MarkButton({
  segment,
  label,
  color,
  dimmed,
  onClick,
}: {
  segment: Segment
  label: string
  color: string
  dimmed: boolean
  onClick: () => void
}) {
  return (
    <UnstyledButton
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        gridColumn: segment.column,
        gridRow: segment.row,
        position: 'relative',
        padding: 0,
        opacity: dimmed ? 0.35 : 1,
        ['--mark' as string]: color,
      }}
    >
      {segment.shape === 'point' && <Dot derived={segment.derived} />}
      {segment.shape === 'open' && (
        <>
          <OpenStub toward={segment.toward ?? 'after'} />
          <Dot derived={segment.derived} />
        </>
      )}
      {segment.shape === 'span' && (
        <SpanLine derived={segment.derived} top={segment.top ?? 'edge'} bottom={segment.bottom ?? 'edge'} />
      )}
    </UnstyledButton>
  )
}

function Dot({ derived }: { derived: boolean }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: '50%',
        top: LINE,
        width: 11,
        height: 11,
        marginLeft: -5.5,
        marginTop: -5.5,
        borderRadius: '50%',
        boxSizing: 'border-box',
        background: derived ? 'var(--mantine-color-body)' : 'var(--mark)',
        border: '2px solid var(--mark)',
      }}
    />
  )
}

function OpenStub({ toward }: { toward: 'after' | 'before' }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: '50%',
        width: 3,
        marginLeft: -1.5,
        height: 16,
        top: toward === 'after' ? LINE : LINE - 16,
        background:
          toward === 'after'
            ? 'linear-gradient(var(--mark), transparent)'
            : 'linear-gradient(transparent, var(--mark))',
      }}
    />
  )
}

function SpanLine({
  derived,
  top,
  bottom,
}: {
  derived: boolean
  top: 'line' | 'edge'
  bottom: 'line' | 'edge'
}) {
  return (
    <span
      style={{
        position: 'absolute',
        left: '50%',
        width: derived ? 0 : 3,
        marginLeft: -1.5,
        borderLeft: derived ? '3px dashed var(--mark)' : undefined,
        background: derived ? undefined : 'var(--mark)',
        top: top === 'line' ? LINE : 0,
        bottom: bottom === 'line' ? `calc(100% - ${LINE}px)` : 0,
      }}
    />
  )
}

function Unplaced({
  layout,
  name,
  shown,
  highlightIds,
  selectedId,
  onSelect,
}: {
  layout: TimelineLayout
  name: (id: string) => string
  shown: ReadonlySet<string> | null
  highlightIds: ReadonlySet<string> | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const groups = [
    {
      title: 'Time unspecified',
      entries: layout.timeUnspecified,
      text: (entry: UnplacedEntry) =>
        entry.spanIndex === null ? 'No time is recorded.' : 'A period with neither bound recorded.',
    },
    {
      title: 'Not resolved',
      entries: layout.notResolved,
      text: (entry: UnplacedEntry) => entry.reasons.map((reason) => unresolvedText(reason, name)).join(' '),
    },
    {
      title: 'Ends before it starts',
      entries: layout.endsBeforeStart,
      text: () => 'The start is after the end.',
    },
  ]
  if (groups.every((group) => group.entries.length === 0)) return null
  return (
    <Stack gap="sm">
      <Title order={3}>Events with no place</Title>
      {groups.map((group) =>
        group.entries.length === 0 ? null : (
          <div key={group.title}>
            <Text fw={600} size="sm">
              {group.title}
            </Text>
            <Stack gap={4} mt={4}>
              {group.entries.map((entry) => (
                <EventHeading
                  key={`${entry.eventId}-${entry.spanIndex}`}
                  eventId={entry.eventId}
                  name={name}
                  selected={entry.eventId === selectedId}
                  related={false}
                  dimmed={isDimmed(entry.eventId, shown, highlightIds)}
                  onSelect={onSelect}
                  note={group.text(entry)}
                />
              ))}
            </Stack>
          </div>
        ),
      )}
    </Stack>
  )
}

function markColor(
  eventId: string,
  selectedId: string | null,
  linked: ReadonlySet<string> | null,
): string {
  if (eventId === selectedId) return 'var(--mantine-color-blue-6)'
  if (linked?.has(eventId)) return 'var(--mantine-color-orange-7)'
  return 'var(--mantine-color-orange-5)'
}

function markLabel(
  title: string,
  mark: Mark,
  momentLabel: (timestamp: string) => string,
  name: (id: string) => string,
): string {
  return `${title}. ${sentence(mark, momentLabel, name)}`
}

function sentence(
  mark: Mark,
  momentLabel: (timestamp: string) => string,
  name: (id: string) => string,
): string {
  if (mark.kind === 'point') return `At ${boundPhrase(mark.at, momentLabel, name)}.`
  if (mark.kind === 'open') {
    const bound = boundPhrase(mark.at, momentLabel, name)
    return mark.toward === 'after'
      ? `From ${bound}, with no recorded end.`
      : `Until ${bound}, with no recorded start.`
  }
  return `From ${boundPhrase(mark.start, momentLabel, name)} to ${boundPhrase(mark.end, momentLabel, name)}.`
}

function boundPhrase(
  endpoint: MarkEndpoint,
  momentLabel: (timestamp: string) => string,
  name: (id: string) => string,
): string {
  if (endpoint.source === 'written') {
    return `${momentLabel(endpoint.timestamp)} (written as a timestamp)`
  }
  const edge = endpoint.edge === 'end' ? 'end' : 'start'
  return `the ${edge} of “${name(endpoint.eventId ?? '')}”`
}

function unresolvedText(reason: UnplacedReason, name: (id: string) => string): string {
  const stopped = reason.eventIds[reason.eventIds.length - 1]
  const who = stopped ? `“${name(stopped)}”` : 'the Event it names'
  const why =
    reason.code === 'no_time'
      ? `${who} has no time`
      : reason.code === 'several_spans'
        ? `${who} has several spans`
        : `${who} has no recorded ${reason.edge === 'end' ? 'end' : 'start'}`
  const where = reason.place === 'at' ? 'The time' : `The ${reason.place}`
  if (reason.eventIds.length > 1) {
    const chain = reason.eventIds.map((id) => `“${name(id)}”`).join(', then ')
    return `${where} follows ${chain}, and stops because ${why}.`
  }
  return `${where} does not resolve: ${why}.`
}

function isDimmed(
  eventId: string,
  shown: ReadonlySet<string> | null,
  highlightIds: ReadonlySet<string> | null,
): boolean {
  if (highlightIds !== null && !highlightIds.has(eventId)) return true
  if (shown !== null && !shown.has(eventId)) return true
  return false
}

function highlightOptions(story: Story, name: (id: string) => string): NonNullable<NativeSelectProps['data']> {
  const data: (
    | { value: string; label: string }
    | { group: string; items: { value: string; label: string }[] }
  )[] = [{ value: '', label: 'All events' }]
  if (story.entities.length > 0) {
    data.push({
      group: 'Entities',
      items: story.entities.map((entity) => ({ value: entity.id, label: name(entity.id) })),
    })
  }
  if (story.arcs.length > 0) {
    data.push({
      group: 'Arcs',
      items: story.arcs.map((arc) => ({ value: arc.id, label: name(arc.id) })),
    })
  }
  return data
}

function visibleIds(
  layout: TimelineLayout,
  time: TimeSelection | null,
  linked: ReadonlySet<string> | null,
): Set<string> | null {
  if (!time) return null
  const ids = new Set<string>()
  const add = (reading: InProgress) => {
    for (const id of [...reading.happening, ...reading.begunNoEnd, ...reading.endedNoStart]) {
      ids.add(id)
    }
  }
  add(inProgress(layout, time))
  if (time.kind === 'stretch') {
    add(inProgress(layout, { kind: 'moment', timestamp: time.from }))
    add(inProgress(layout, { kind: 'moment', timestamp: time.to }))
  }
  if (linked) for (const id of linked) ids.add(id)
  return ids
}

function sameTime(left: TimeSelection, right: TimeSelection): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'moment' && right.kind === 'moment') return left.timestamp === right.timestamp
  return (
    left.kind === 'stretch' &&
    right.kind === 'stretch' &&
    left.from === right.from &&
    left.to === right.to
  )
}
