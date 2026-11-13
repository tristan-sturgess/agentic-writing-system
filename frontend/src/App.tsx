import { Anchor, AppShell, Container, Group, Text } from '@mantine/core'
import { Link, Route, Routes } from 'react-router'

import { EntitiesView } from './entities/EntitiesView'
import { RecordsView } from './pages/RecordsView'
import { StoryListPage } from './pages/StoryListPage'
import { OpenRecords, StoryLayout } from './pages/StoryLayout'
import { TimelineView } from './timeline/TimelineView'

export default function App() {
  return (
    <AppShell header={{ height: 52 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Anchor component={Link} to="/" fw={700} c="inherit" underline="never">
            Agentic Writing System
          </Anchor>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg">
          <Routes>
            <Route path="/" element={<StoryListPage />} />
            <Route path="/stories/:storyId" element={<StoryLayout />}>
              <Route index element={<OpenRecords />} />
              <Route path="records" element={<RecordsView />} />
              <Route path="timeline" element={<TimelineView />} />
              <Route path="entities" element={<EntitiesView />} />
            </Route>
            {/* The service answers any path outside /api with this app. */}
            <Route path="*" element={<NoSuchPage />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

function NoSuchPage() {
  return (
    <Text>
      There is no page at this address.{' '}
      <Anchor component={Link} to="/">
        Go to the stories.
      </Anchor>
    </Text>
  )
}
