import { Alert, Anchor, Code, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

import { describeFailure, listStories, type StorySummary } from '../api/client'
import { RecordId } from '../story/parts'
import { useLoad } from '../useLoad'

export function StoryListPage() {
  const stories = useLoad(listStories)
  return (
    <Stack gap="md">
      <Title order={2}>Stories</Title>
      {stories.status === 'loading' && <Loader />}
      {stories.status === 'failed' && (
        <Alert color="red" title="The stories could not be loaded">
          {describeFailure(stories.error)}
        </Alert>
      )}
      {stories.status === 'loaded' && <StoryTable stories={stories.data} />}
    </Stack>
  )
}

function StoryTable({ stories }: { stories: StorySummary[] }) {
  if (stories.length === 0) {
    return (
      <Text>
        There are no stories yet. To import the sample, run{' '}
        <Code>poetry run python scripts/story_api.py import samples/sample_story.json</Code>
      </Text>
    )
  }
  return (
    <Table verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Title</Table.Th>
          <Table.Th>Last changed</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {stories.map((story) => (
          <Table.Tr key={story.id}>
            <Table.Td>
              <Anchor component={Link} to={`/stories/${story.id}`} fw={600}>
                {story.title || 'Untitled story'}
              </Anchor>
              <br />
              <RecordId id={story.id} />
            </Table.Td>
            <Table.Td>{new Date(story.updated_at).toLocaleString()}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
