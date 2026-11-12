import { Table, Text } from '@mantine/core'

import type { Story } from '../api/client'
import { Empty, Prose, RecordId, RecordRefs, When } from './parts'
import type { RecordIndex } from './records'

/**
 * The Events as a list, in the order they were created. Arranging them in
 * story time is the first picture, which a later step draws.
 */
export function EventsSection({ story, index }: { story: Story; index: RecordIndex }) {
  if (story.events.length === 0) {
    return <Empty>This story has no Events.</Empty>
  }
  return (
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
              <Text fw={600}>{event.title}</Text>
              <RecordId id={event.id} />
              {event.description && <Prose>{event.description}</Prose>}
            </Table.Td>
            <Table.Td>
              <When spans={event.when} index={index} empty="Time unspecified" />
            </Table.Td>
            <Table.Td>
              <RecordRefs ids={event.entity_ids} index={index} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
