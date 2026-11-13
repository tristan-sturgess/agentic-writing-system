import {
  Alert,
  Button,
  Group,
  Loader,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title,
  type NativeSelectProps,
} from '@mantine/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  describeFailure,
  getEventTimes,
  getInForce,
  getStatementTimes,
  type EventTimes,
  type InForce,
  type StatementTimes,
  type Story,
} from '../api/client'
import { useStory } from '../pages/storyContext'
import { Empty, Prose, RecordId, RecordLink, RecordRefs, StatementLinks, type SelectRecord } from '../story/parts'
import { indexRecords, labelOf, type RecordIndex } from '../story/records'
import { useLoad } from '../useLoad'
import { layOutTimeline } from '../timeline/layout'
import {
  assertionRows,
  describeComparison,
  describeQuery,
  describeResolvedSpan,
  inForceChoice,
  inForceForEntity,
  propertyRows,
  viewedEntityId,
  type InForceChoice,
  type StatementRow,
} from './layout'

/**
 * One Entity, its Properties over story time, the Assertions that name it,
 * and what is in force at a chosen time. The service resolved the spans and
 * decided what is in force. `?entity=` is the Entity. `?at=` and `?edge=` are
 * the time. Selecting a record is `?record=`, the detail panel every view shares.
 */
export function EntitiesView() {
  const outlet = useStory()
  const story = outlet?.story
  const storyId = story?.id ?? ''
  const [params, setParams] = useSearchParams()
  const entityParam = params.get('entity')
  const at = params.get('at')
  const edge = params.get('edge')
  const viewed = story ? viewedEntityId(story, entityParam, outlet?.selectedId ?? null) : null

  useEffect(() => {
    if (!viewed || entityParam === viewed) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('entity', viewed)
        return next
      },
      { replace: true },
    )
  }, [viewed, entityParam, setParams])

  const loadTimes = useCallback((): Promise<{ statements: StatementTimes; events: EventTimes }> => {
    if (storyId === '') return Promise.resolve({ statements: { properties: [], assertions: [] }, events: { events: [] } })
    return Promise.all([getStatementTimes(storyId), getEventTimes(storyId)]).then(
      ([statements, events]) => ({ statements, events }),
    )
  }, [storyId])
  const times = useLoad(loadTimes)

  const choice = useMemo(() => inForceChoice(at, edge), [at, edge])
  const loadHeld = useCallback((): Promise<InForce | null> => {
    if (storyId === '' || choice === null) return Promise.resolve(null)
    const query =
      choice.kind === 'timestamp'
        ? { timestamp: choice.timestamp }
        : { eventId: choice.eventId, edge: choice.edge }
    return getInForce(storyId, query)
  }, [storyId, choice])
  const held = useLoad(loadHeld)

  const setTime = useCallback(
    (nextAt: string | null, nextEdge: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (nextAt) next.set('at', nextAt)
        else next.delete('at')
        if (nextEdge) next.set('edge', nextEdge)
        else next.delete('edge')
        return next
      })
    },
    [setParams],
  )
  const chooseEntity = useCallback(
    (id: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('entity', id)
        return next
      })
    },
    [setParams],
  )

  if (!outlet || !story) return null
  if (story.entities.length === 0) return <Empty>This story has no Entities.</Empty>
  if (times.status === 'loading') return <Loader />
  if (times.status === 'failed') {
    return (
      <Alert color="red" title="The statement times could not be loaded">
        {describeFailure(times.error)}
      </Alert>
    )
  }
  if (!viewed) return <Empty>This story has no Entities.</Empty>

  const index = indexRecords(story)
  const name = (id: string) => labelOf(index, id)
  const entity = story.entities.find((item) => item.id === viewed)
  if (!entity) return <Empty>This story has no Entities.</Empty>

  return (
    <EntityScreen
      story={story}
      entityId={entity.id}
      entityName={entity.name}
      entityNotes={entity.notes}
      index={index}
      name={name}
      statements={times.data.statements}
      events={times.data.events}
      choice={choice}
      held={held}
      onSelect={outlet.selectRecord}
      onEntity={chooseEntity}
      onTime={setTime}
    />
  )
}

function EntityScreen({
  story,
  entityId,
  entityName,
  entityNotes,
  index,
  name,
  statements,
  events,
  choice,
  held,
  onSelect,
  onEntity,
  onTime,
}: {
  story: Story
  entityId: string
  entityName: string
  entityNotes: string
  index: RecordIndex
  name: (id: string) => string
  statements: StatementTimes
  events: EventTimes
  choice: InForceChoice | null
  held: ReturnType<typeof useLoad<InForce | null>>
  onSelect: SelectRecord
  onEntity: (id: string) => void
  onTime: (at: string | null, edge: string | null) => void
}) {
  const properties = propertyRows(story, statements, entityId)
  const assertions = assertionRows(story, statements, entityId)
  const moments = useMemo(() => layOutTimeline(story, events).moments, [story, events])
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)

  const commitDraft = () => {
    const value = draft.trim()
    if (inForceChoice(value, null)?.kind !== 'timestamp') {
      setDraftError('A timestamp is a date, YYYY-MM-DD, or a date and time.')
      return
    }
    setDraftError(null)
    onTime(value, null)
  }

  return (
    <Stack gap="lg">
      <NativeSelect
        label="Entity"
        value={entityId}
        onChange={(event) => onEntity(event.currentTarget.value)}
        data={story.entities.map((entity) => ({ value: entity.id, label: entity.name }))}
        maw={360}
      />
      <Stack gap={4}>
        <Title order={3}>{entityName}</Title>
        <RecordId id={entityId} />
        {entityNotes ? <Prose>{entityNotes}</Prose> : null}
      </Stack>

      <section>
        <Title order={4} mb="xs">
          Properties
        </Title>
        {properties.length === 0 ? (
          <Empty>This Entity has no Properties.</Empty>
        ) : (
          <Stack gap="sm">
            {properties.map((row) => (
              <StatementBlock
                key={row.id}
                row={row}
                text={name(row.id)}
                name={name}
                index={index}
                onSelect={onSelect}
              />
            ))}
          </Stack>
        )}
      </section>

      <section>
        <Title order={4} mb="xs">
          Assertions
        </Title>
        {assertions.length === 0 ? (
          <Empty>No Assertion names this Entity.</Empty>
        ) : (
          <Stack gap="sm">
            {assertions.map((row) => {
              const assertion = story.assertions.find((item) => item.id === row.id)
              const others = assertion
                ? [
                    ...assertion.entity_ids.filter((id) => id !== entityId),
                    ...assertion.event_ids,
                    ...assertion.arc_ids,
                  ]
                : []
              return (
                <StatementBlock
                  key={row.id}
                  row={row}
                  text={name(row.id)}
                  name={name}
                  index={index}
                  onSelect={onSelect}
                  others={others}
                />
              )
            })}
          </Stack>
        )}
      </section>

      <section>
        <Title order={4} mb="xs">
          In force
        </Title>
        <Stack gap="sm">
          <NativeSelect
            label="Time"
            value={selectedTime(choice)}
            onChange={(event) => onTimeValue(event.currentTarget.value, onTime)}
            data={timeOptions(story, moments, choice, name)}
            maw={360}
          />
          <Group align="flex-end" gap="sm">
            <TextInput
              label="Or a timestamp"
              placeholder="1847-03-12"
              value={draft}
              onChange={(event) => {
                setDraft(event.currentTarget.value)
                setDraftError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitDraft()
              }}
              error={draftError}
              maw={240}
            />
            <Button variant="default" onClick={commitDraft}>
              Use this timestamp
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            A statement listed here holds at this time. A line that says a span does not resolve is
            a comparison the service could not make.
          </Text>
          {choice === null ? (
            <Empty>Pick a time to see what is in force.</Empty>
          ) : held.status === 'loading' ? (
            <Loader size="sm" />
          ) : held.status === 'failed' ? (
            <Alert color="red" title="What is in force could not be loaded">
              {describeFailure(held.error)}
            </Alert>
          ) : (
            held.data && (
              <InForceList
                story={story}
                entityId={entityId}
                reading={held.data}
                name={name}
                onSelect={onSelect}
              />
            )
          )}
        </Stack>
      </section>
    </Stack>
  )
}

function StatementBlock({
  row,
  text,
  name,
  index,
  onSelect,
  others,
}: {
  row: StatementRow
  text: string
  name: (id: string) => string
  index: RecordIndex
  onSelect: SelectRecord
  others?: string[]
}) {
  return (
    <Stack gap={2}>
      <RecordLink id={row.id} onSelect={onSelect} fw={600}>
        {text}
      </RecordLink>
      {others && others.length > 0 && (
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            With
          </Text>
          <RecordRefs ids={others} index={index} onSelect={onSelect} />
        </Group>
      )}
      {row.spans.length === 0 ? (
        <Text size="sm">Holds throughout. No time was recorded.</Text>
      ) : (
        row.spans.map((span, position) => (
          <Text key={position} size="sm">
            {describeResolvedSpan(span, name)}
          </Text>
        ))
      )}
      <StatementLinks
        causedBy={row.causedBy}
        supersedes={row.supersedes}
        index={index}
        onSelect={onSelect}
      />
      {row.supersededBy.length > 0 && (
        <Text size="sm" c="dimmed">
          Replaced by:{' '}
          {row.supersededBy.map((id, position) => (
            <span key={id}>
              {position > 0 && ', '}
              <RecordLink id={id} onSelect={onSelect}>
                {name(id)}
              </RecordLink>
            </span>
          ))}
        </Text>
      )}
    </Stack>
  )
}

function InForceList({
  story,
  entityId,
  reading,
  name,
  onSelect,
}: {
  story: Story
  entityId: string
  reading: InForce
  name: (id: string) => string
  onSelect: SelectRecord
}) {
  const held = inForceForEntity(story, reading.statements, entityId)
  return (
    <Stack gap="sm">
      <Text size="sm">{describeQuery(reading.query, name)}</Text>
      <HeldGroup title="Properties" statements={held.properties} name={name} onSelect={onSelect} />
      <HeldGroup title="Assertions" statements={held.assertions} name={name} onSelect={onSelect} />
    </Stack>
  )
}

function HeldGroup({
  title,
  statements,
  name,
  onSelect,
}: {
  title: string
  statements: InForce['statements']
  name: (id: string) => string
  onSelect: SelectRecord
}) {
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        {title}
      </Text>
      {statements.length === 0 ? (
        <Empty>None.</Empty>
      ) : (
        statements.map((statement) => (
          <Stack key={statement.id} gap={0}>
            <RecordLink id={statement.id} onSelect={onSelect}>
              {name(statement.id)}
            </RecordLink>
            {statement.unresolved.map((mark) => (
              <Text key={`${mark.span}-${mark.bound}`} size="sm" c="orange.8">
                {describeComparison(mark, name)}
              </Text>
            ))}
          </Stack>
        ))
      )}
    </Stack>
  )
}

function timeOptions(
  story: Story,
  moments: { timestamp: string; label: string }[],
  choice: InForceChoice | null,
  name: (id: string) => string,
): NonNullable<NativeSelectProps['data']> {
  const momentItems = moments.map((moment) => ({ value: `t:${moment.timestamp}`, label: moment.label }))
  if (
    choice?.kind === 'timestamp' &&
    !moments.some((moment) => moment.timestamp === choice.timestamp)
  ) {
    momentItems.unshift({
      value: `t:${choice.timestamp}`,
      label: choice.timestamp.replace('T', ' '),
    })
  }
  const data: (
    | { value: string; label: string }
    | { group: string; items: { value: string; label: string }[] }
  )[] = [{ value: '', label: 'Pick a time' }]
  if (momentItems.length > 0) data.push({ group: 'Moments', items: momentItems })
  if (story.events.length > 0) {
    data.push({
      group: 'Events',
      items: story.events.flatMap((event) => [
        { value: `e:${event.id}:start`, label: `the start of ${name(event.id)}` },
        { value: `e:${event.id}:end`, label: `the end of ${name(event.id)}` },
      ]),
    })
  }
  return data
}

function selectedTime(choice: InForceChoice | null): string {
  if (!choice) return ''
  if (choice.kind === 'timestamp') return `t:${choice.timestamp}`
  return `e:${choice.eventId}:${choice.edge}`
}

function onTimeValue(value: string, onTime: (at: string | null, edge: string | null) => void) {
  if (!value) {
    onTime(null, null)
    return
  }
  if (value.startsWith('t:')) {
    onTime(value.slice(2), null)
    return
  }
  const edge = value.endsWith(':end') ? 'end' : 'start'
  onTime(value.slice(2, value.length - edge.length - 1), edge)
}
