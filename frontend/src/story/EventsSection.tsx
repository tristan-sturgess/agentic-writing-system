import { Button, Stack, Table } from '@mantine/core'

import type { Story } from '../api/client'
import { Empty, Prose, RecordId, RecordLink, RecordRefs, When, type SelectRecord } from './parts'
import type { RecordIndex } from './records'

/**
 * The Events as a list, in the order they were created. The timeline draws
 * the same Events in story time.
 */
export function EventsSection({
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
  return (
    <Stack gap="md">
      <div>
        <Button type="button" onClick={onNew}>
          New Event
        </Button>
      </div>
      {story.events.length === 0 ? (
        <Empty>This story has no Events.</Empty>
      ) : (
    <Table verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Event</Table.Th>
          <Table.Th>When</Table.Th>
          <Table.Th>Entities</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {story.events.map((event) => (
          <Table.Tr key={event.id} style={{ verticalAlign: 'top' }}>
            <Table.Td>
              <div>
                <RecordLink id={event.id} onSelect={onSelect} fw={600}>
                  {event.title}
                </RecordLink>
              </div>
              <RecordId id={event.id} />
              {event.description && <Prose>{event.description}</Prose>}
            </Table.Td>
            <Table.Td>
              <When spans={event.when} index={index} empty="Time unspecified" />
            </Table.Td>
            <Table.Td>
              <RecordRefs ids={event.entity_ids} index={index} onSelect={onSelect} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
      )}
    </Stack>
  )
}
