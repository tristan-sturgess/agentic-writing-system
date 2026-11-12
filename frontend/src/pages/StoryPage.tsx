import { Alert, Anchor, Loader, Stack, Tabs, Title } from '@mantine/core'
import { useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router'

import { ApiError, describeFailure, getStory, type Story } from '../api/client'
import { ArcsSection } from '../story/ArcsSection'
import { AssertionsSection } from '../story/AssertionsSection'
import { EntitiesSection } from '../story/EntitiesSection'
import { EventsSection } from '../story/EventsSection'
import { FramingSection } from '../story/FramingSection'
import { indexRecords } from '../story/records'
import { UnitsSection } from '../story/UnitsSection'
import { useLoad } from '../useLoad'

export function StoryPage() {
  const { storyId = '' } = useParams()
  const load = useCallback(() => getStory(storyId), [storyId])
  const story = useLoad(load)
  return (
    <Stack gap="md">
      <Anchor component={Link} to="/" size="sm">
        All stories
      </Anchor>
      {story.status === 'loading' && <Loader />}
      {story.status === 'failed' && <StoryFailed error={story.error} />}
      {story.status === 'loaded' && <StoryRecords story={story.data} />}
    </Stack>
  )
}

function StoryFailed({ error }: { error: Error }) {
  // A story the acting user does not own is the same `404` as one that is gone.
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Alert color="yellow" title="There is no story at this address">
        It may have been deleted.
      </Alert>
    )
  }
  return (
    <Alert color="red" title="The story could not be loaded">
      {describeFailure(error)}
    </Alert>
  )
}

function StoryRecords({ story }: { story: Story }) {
  const index = useMemo(() => indexRecords(story), [story])
  return (
    <>
      <Title order={2}>{story.title || 'Untitled story'}</Title>
      <Tabs defaultValue="framing">
        <Tabs.List>
          <Tabs.Tab value="framing">Framing</Tabs.Tab>
          <Tabs.Tab value="entities">Entities ({story.entities.length})</Tabs.Tab>
          <Tabs.Tab value="events">Events ({story.events.length})</Tabs.Tab>
          <Tabs.Tab value="arcs">Arcs ({story.arcs.length})</Tabs.Tab>
          <Tabs.Tab value="assertions">Assertions ({story.assertions.length})</Tabs.Tab>
          <Tabs.Tab value="units">Narrative Units ({story.units.length})</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="framing" pt="md">
          <FramingSection story={story} />
        </Tabs.Panel>
        <Tabs.Panel value="entities" pt="md">
          <EntitiesSection story={story} index={index} />
        </Tabs.Panel>
        <Tabs.Panel value="events" pt="md">
          <EventsSection story={story} index={index} />
        </Tabs.Panel>
        <Tabs.Panel value="arcs" pt="md">
          <ArcsSection story={story} index={index} />
        </Tabs.Panel>
        <Tabs.Panel value="assertions" pt="md">
          <AssertionsSection story={story} index={index} />
        </Tabs.Panel>
        <Tabs.Panel value="units" pt="md">
          <UnitsSection story={story} index={index} />
        </Tabs.Panel>
      </Tabs>
    </>
  )
}
