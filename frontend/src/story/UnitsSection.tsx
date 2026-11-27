import { Box, Button, Group, Stack, Text } from '@mantine/core'

import type { NarrativeUnit, Story } from '../api/client'
import { Empty, Prose, RecordId, RecordLink, RecordRefs, type SelectRecord } from './parts'
import type { RecordIndex } from './records'

/**
 * The Narrative Units as the tree they are stored as: the story's `unit_ids`
 * at the top, each unit's `child_ids` beneath it, both in reading order.
 */
export function UnitsSection({
  story,
  index,
  onSelect,
  onNew,
}: {
  story: Story
  index: RecordIndex
  onSelect: SelectRecord
  onNew: () => void
}) {
  const units = new Map(story.units.map((unit) => [unit.id, unit]))
  return (
    <Stack gap="md">
      <div>
        <Button type="button" onClick={onNew}>
          New Narrative Unit
        </Button>
      </div>
      {story.unit_ids.length === 0 ? (
        <Empty>This story has no Narrative Units.</Empty>
      ) : (
        <UnitList ids={story.unit_ids} units={units} index={index} onSelect={onSelect} />
      )}
    </Stack>
  )
}

function UnitList({
  ids,
  units,
  index,
  onSelect,
}: {
  ids: string[]
  units: ReadonlyMap<string, NarrativeUnit>
  index: RecordIndex
  onSelect: SelectRecord
}) {
  return (
    <Stack gap="md">
      {ids.map((id) => {
        const unit = units.get(id)
        // The service refuses a list that names a unit the story lacks.
        if (!unit) {
          return <RecordId key={id} id={id} />
        }
        return (
          <div key={id}>
            <Group gap="sm" align="baseline">
              <RecordLink id={unit.id} onSelect={onSelect} fw={600}>
                {unit.title}
              </RecordLink>
              <RecordId id={unit.id} />
            </Group>
            {unit.summary && <Prose>{unit.summary}</Prose>}
            {unit.notes && (
              <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                Notes: {unit.notes}
              </Text>
            )}
            {unit.subject_ids.length > 0 && (
              <Group gap="xs" mt={4}>
                <Text size="sm" c="dimmed">
                  Depicts
                </Text>
                <RecordRefs ids={unit.subject_ids} index={index} onSelect={onSelect} />
              </Group>
            )}
            {unit.child_ids.length > 0 && (
              <Box
                mt="sm"
                pl="md"
                style={{ borderLeft: '2px solid var(--mantine-color-gray-3)' }}
              >
                <UnitList ids={unit.child_ids} units={units} index={index} onSelect={onSelect} />
              </Box>
            )}
          </div>
        )
      })}
    </Stack>
  )
}
