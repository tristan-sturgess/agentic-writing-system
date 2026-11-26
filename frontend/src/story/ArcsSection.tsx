import { Group, List, Paper, Stack, Text, Title } from '@mantine/core'

import type { Story } from '../api/client'
import { Empty, Prose, RecordId, RecordLink, type SelectRecord } from './parts'
import type { RecordIndex } from './records'

/**
 * Each Arc with its Events in the Arc's own order, which may differ from story
 * time. Laying the Arcs over the Events is the second picture, in a later step.
 */
export function ArcsSection({
  story,
  index,
  onSelect,
}: {
  story: Story
  index: RecordIndex
  onSelect: SelectRecord
}) {
  if (story.arcs.length === 0) {
    return <Empty>This story has no Arcs.</Empty>
  }
  return (
    <Stack gap="md">
      {story.arcs.map((arc) => (
        <Paper key={arc.id} withBorder p="md">
          <Group gap="sm" align="baseline">
            <Title order={4}>
              <RecordLink id={arc.id} onSelect={onSelect}>
                {arc.title}
              </RecordLink>
            </Title>
            <RecordId id={arc.id} />
          </Group>
          {arc.description && <Prose>{arc.description}</Prose>}

          <Text fw={600} size="sm" mt="md" mb={4}>
            Events, in the Arc's order
          </Text>
          {arc.event_ids.length === 0 ? (
            <Empty>None</Empty>
          ) : (
            <List type="ordered" size="sm">
              {arc.event_ids.map((eventId) => (
                <List.Item key={eventId} title={eventId}>
                  <RecordLink id={eventId} onSelect={onSelect}>
                    {index.get(eventId)?.label ?? eventId}
                  </RecordLink>
                </List.Item>
              ))}
            </List>
          )}
        </Paper>
      ))}
    </Stack>
  )
}
