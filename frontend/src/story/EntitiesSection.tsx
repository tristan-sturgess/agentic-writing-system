import { Group, Paper, Stack, Text, Title } from '@mantine/core'

import type { Story } from '../api/client'
import { Empty, Prose, RecordId, StatementLinks, When } from './parts'
import { propertiesByEntity, type RecordIndex } from './records'

export function EntitiesSection({ story, index }: { story: Story; index: RecordIndex }) {
  if (story.entities.length === 0) {
    return <Empty>This story has no Entities.</Empty>
  }
  const byEntity = propertiesByEntity(story)
  return (
    <Stack gap="md">
      {story.entities.map((entity) => {
        const properties = byEntity.get(entity.id) ?? []
        return (
          <Paper key={entity.id} withBorder p="md">
            <Group gap="sm" align="baseline">
              <Title order={4}>{entity.name}</Title>
              <RecordId id={entity.id} />
            </Group>
            {entity.notes && <Prose>{entity.notes}</Prose>}

            <Text fw={600} size="sm" mt="md" mb={4}>
              Properties
            </Text>
            {properties.length === 0 ? (
              <Empty>None</Empty>
            ) : (
              <Stack gap="sm">
                {properties.map((property) => (
                  <div key={property.id}>
                    <Text>{property.statement}</Text>
                    <RecordId id={property.id} />
                    <When spans={property.when} index={index} empty="No time recorded" />
                    <StatementLinks
                      causedBy={property.caused_by}
                      supersedes={property.supersedes}
                      index={index}
                    />
                  </div>
                ))}
              </Stack>
            )}
          </Paper>
        )
      })}
    </Stack>
  )
}
