import { Table, Text } from '@mantine/core'

import type { Story } from '../api/client'
import { Empty, RecordId, RecordRefs, StatementLinks, When } from './parts'
import type { RecordIndex } from './records'

export function AssertionsSection({ story, index }: { story: Story; index: RecordIndex }) {
  if (story.assertions.length === 0) {
    return <Empty>This story has no Assertions.</Empty>
  }
  return (
    <Table verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Statement</Table.Th>
          <Table.Th>Names</Table.Th>
          <Table.Th>When</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {story.assertions.map((assertion) => (
          <Table.Tr key={assertion.id} style={{ verticalAlign: 'top' }}>
            <Table.Td>
              <Text>{assertion.statement}</Text>
              <RecordId id={assertion.id} />
              <StatementLinks
                causedBy={assertion.caused_by}
                supersedes={assertion.supersedes}
                index={index}
              />
            </Table.Td>
            <Table.Td>
              <RecordRefs
                ids={[...assertion.entity_ids, ...assertion.event_ids, ...assertion.arc_ids]}
                index={index}
              />
            </Table.Td>
            <Table.Td>
              <When spans={assertion.when} index={index} empty="No time recorded" />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
