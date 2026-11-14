import { Table } from '@mantine/core'

import type { Story } from '../api/client'
import { Empty, RecordId, RecordLink, RecordRefs, StatementLinks, When, type SelectRecord } from './parts'
import type { RecordIndex } from './records'

export function AssertionsSection({
  story,
  index,
  onSelect,
}: {
  story: Story
  index: RecordIndex
  onSelect: SelectRecord
}) {
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
              <div>
                <RecordLink id={assertion.id} onSelect={onSelect}>
                  {assertion.statement}
                </RecordLink>
              </div>
              <RecordId id={assertion.id} />
              <StatementLinks
                causedBy={assertion.caused_by}
                index={index}
                onSelect={onSelect}
              />
            </Table.Td>
            <Table.Td>
              <RecordRefs
                ids={[...assertion.entity_ids, ...assertion.event_ids, ...assertion.arc_ids]}
                index={index}
                onSelect={onSelect}
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
