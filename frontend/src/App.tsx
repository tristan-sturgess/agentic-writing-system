import { Anchor, AppShell, Container, Group, Text } from '@mantine/core'
import { Link, Route, Routes } from 'react-router'

import { StoryListPage } from './pages/StoryListPage'
import { StoryPage } from './pages/StoryPage'

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
            <Route path="/stories/:storyId" element={<StoryPage />} />
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
