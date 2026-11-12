import { Group, Paper, Stack, Text, Title } from '@mantine/core'

import type { Story } from '../api/client'
import { Empty, Prose, RecordId, RecordLink, StatementLinks, When, type SelectRecord } from './parts'
import { propertiesByEntity, type RecordIndex } from './records'

export function EntitiesSection({
  story,
  index,
  onSelect,
}: {
  story: Story
  index: RecordIndex
  onSelect: SelectRecord
}) {
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
              <Title order={4}>
                <RecordLink id={entity.id} onSelect={onSelect}>
                  {entity.name}
                </RecordLink>
              </Title>
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
                    <div>
                      <RecordLink id={property.id} onSelect={onSelect}>
                        {property.statement}
                      </RecordLink>
                    </div>
                    <RecordId id={property.id} />
                    <When spans={property.when} index={index} empty="No time recorded" />
                    <StatementLinks
                      causedBy={property.caused_by}
                      supersedes={property.supersedes}
                      index={index}
                      onSelect={onSelect}
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
