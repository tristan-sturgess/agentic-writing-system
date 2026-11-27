import { Anchor, AppShell, Container, Group, Text } from '@mantine/core'
import { Link, Outlet, RouterProvider, createBrowserRouter } from 'react-router'

import { EntitiesView } from './entities/EntitiesView'
import { GraphView } from './graph/GraphView'
import { HistoryView } from './history/HistoryView'
import { RecordsView } from './pages/RecordsView'
import { StoryListPage } from './pages/StoryListPage'
import { OpenRecords, StoryLayout } from './pages/StoryLayout'
import { TimelineView } from './timeline/TimelineView'

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <StoryListPage /> },
      {
        path: 'stories/:storyId',
        element: <StoryLayout />,
        children: [
          { index: true, element: <OpenRecords /> },
          { path: 'records', element: <RecordsView /> },
          { path: 'timeline', element: <TimelineView /> },
          { path: 'entities', element: <EntitiesView /> },
          { path: 'graph', element: <GraphView /> },
          { path: 'history', element: <HistoryView /> },
        ],
      },
      { path: '*', element: <NoSuchPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}

function Shell() {
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
          <Outlet />
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
