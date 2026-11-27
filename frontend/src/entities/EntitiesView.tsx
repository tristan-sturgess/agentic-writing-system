import { Alert, Group, Loader, NativeSelect, Stack, Text, Title } from '@mantine/core'
import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'

import {
  describeFailure,
  getInForceStretches,
  getStatementTimes,
  type InForceStatement,
  type InForceStretches,
  type StatementTimes,
  type Story,
} from '../api/client'
import { useStory } from '../pages/storyContext'
import { Empty, Prose, RecordId, RecordLink, RecordRefs, StatementLinks, type SelectRecord } from '../story/parts'
import { indexRecords, labelOf, type RecordIndex } from '../story/records'
import { useLoad } from '../useLoad'
import {
  assertionRows,
  describeComparison,
  describeResolvedSpan,
  describeStretch,
  propertyRows,
  selectedStretch,
  stretchKey,
  viewedEntityId,
  type StatementRow,
} from './layout'

/**
 * One Entity, its Properties over story time, the Assertions that name it,
 * and what is in force during a stretch of story time. The service resolved
 * the spans and decided the stretches. `?entity=` is the Entity. `?at=` is
 * the stretch. Selecting a record is `?record=`, the detail panel every view shares.
 */
export function EntitiesView() {
  const outlet = useStory()
  const story = outlet?.story
  const storyId = story?.id ?? ''
  // A save loads the story again, and `updated_at` moves, so these reads load with it.
  const updatedAt = story?.updated_at ?? ''
  const [params, setParams] = useSearchParams()
  const entityParam = params.get('entity')
  const at = params.get('at')
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

  const loadTimes = useCallback((): Promise<StatementTimes> => {
    // `updatedAt` is part of the load so a save, which changes it, fetches again.
    if (storyId === '' || updatedAt === '') return Promise.resolve({ properties: [], assertions: [] })
    return getStatementTimes(storyId)
  }, [storyId, updatedAt])
  const times = useLoad(loadTimes)

  const loadStretches = useCallback((): Promise<InForceStretches | null> => {
    if (storyId === '' || updatedAt === '' || !viewed) return Promise.resolve(null)
    return getInForceStretches(storyId, viewed)
  }, [storyId, viewed, updatedAt])
  const stretches = useLoad(loadStretches)

  const chooseStretch = useCallback(
    (key: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (key) next.set('at', key)
        else next.delete('at')
        next.delete('edge')
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
      statements={times.data}
      stretches={stretches}
      at={at}
      onSelect={outlet.selectRecord}
      onEntity={chooseEntity}
      onStretch={chooseStretch}
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
  stretches,
  at,
  onSelect,
  onEntity,
  onStretch,
}: {
  story: Story
  entityId: string
  entityName: string
  entityNotes: string
  index: RecordIndex
  name: (id: string) => string
  statements: StatementTimes
  stretches: ReturnType<typeof useLoad<InForceStretches | null>>
  at: string | null
  onSelect: SelectRecord
  onEntity: (id: string) => void
  onStretch: (key: string | null) => void
}) {
  const properties = propertyRows(story, statements, entityId)
  const assertions = assertionRows(story, statements, entityId)
  const chosen =
    stretches.status === 'loaded' && stretches.data
      ? selectedStretch(stretches.data.stretches, at)
      : null

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
          {stretches.status === 'loading' ? (
            <Loader size="sm" />
          ) : stretches.status === 'failed' ? (
            <Alert color="red" title="The stretches could not be loaded">
              {describeFailure(stretches.error)}
            </Alert>
          ) : (
            stretches.data && (
              <NativeSelect
                label="Stretch"
                value={chosen ? stretchKey(chosen) : ''}
                onChange={(event) => onStretch(event.currentTarget.value || null)}
                data={[
                  { value: '', label: 'Pick a stretch' },
                  ...stretches.data.stretches.map((stretch) => ({
                    value: stretchKey(stretch),
                    label: describeStretch(stretch),
                  })),
                ]}
                maw={420}
              />
            )
          )}
          <Text size="sm" c="dimmed">
            Each stretch is a span of story time in which the same statements hold. A line that says
            a span does not resolve is a comparison the service could not make.
          </Text>
          {stretches.status === 'loaded' && chosen === null ? (
            <Empty>Pick a stretch to see what is in force.</Empty>
          ) : (
            chosen && (
              <InForceList
                label={describeStretch(chosen)}
                statements={chosen.statements}
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
      <StatementLinks causedBy={row.causedBy} index={index} onSelect={onSelect} />
    </Stack>
  )
}

function InForceList({
  label,
  statements,
  name,
  onSelect,
}: {
  label: string
  statements: InForceStatement[]
  name: (id: string) => string
  onSelect: SelectRecord
}) {
  return (
    <Stack gap="sm">
      <Text size="sm">{label}</Text>
      <HeldGroup
        title="Properties"
        statements={statements.filter((statement) => statement.kind === 'property')}
        name={name}
        onSelect={onSelect}
      />
      <HeldGroup
        title="Assertions"
        statements={statements.filter((statement) => statement.kind === 'assertion')}
        name={name}
        onSelect={onSelect}
      />
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
  statements: InForceStatement[]
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

