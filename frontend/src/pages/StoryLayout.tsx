import {
  Alert,
  Anchor,
  Box,
  Drawer,
  Group,
  Loader,
  Paper,
  Stack,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useCallback, useMemo } from 'react'
import { Link, Navigate, Outlet, useLocation, useMatch, useParams, useSearchParams } from 'react-router'

import { ApiError, describeFailure, getStory } from '../api/client'
import { DetailPanel } from '../story/DetailPanel'
import { indexRecords } from '../story/records'
import { useLoad } from '../useLoad'
import type { StoryOutlet } from './storyContext'

// A view is added here when its screen exists. The graph is a later step,
// and this page does not link to a view that has no screen.
const VIEWS = [
  { path: 'records', label: 'Records' },
  { path: 'timeline', label: 'Timeline' },
  { path: 'entities', label: 'Entities' },
] as const

/**
 * One story, loaded once for every view under it.
 *
 * `/stories/{id}` redirects to the records view. The selected record is
 * `?record=`, and the view links keep it, so it survives a reload and a
 * change of view.
 */
export function StoryLayout() {
  const { storyId = '' } = useParams()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const load = useCallback(() => getStory(storyId), [storyId])
  const story = useLoad(load)
  const theme = useMantineTheme()
  const wide = useMediaQuery(`(min-width: ${theme.breakpoints.md})`, true, {
    getInitialValueInEffect: false,
  })

  const selectedId = params.get('record')
  const selectRecord = useCallback(
    (id: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('record', id)
        return next
      })
    },
    [setParams],
  )
  const clearRecord = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('record')
      return next
    })
  }, [setParams])

  const loaded = story.status === 'loaded' ? story.data : null
  const index = useMemo(() => (loaded ? indexRecords(loaded) : null), [loaded])
  const outlet = loaded ? (
    <Outlet context={{ story: loaded, selectedId, selectRecord } satisfies StoryOutlet} />
  ) : (
    <Outlet context={null} />
  )

  return (
    <Stack gap="md">
      <Anchor component={Link} to="/" size="sm">
        All stories
      </Anchor>
      {story.status === 'loading' && (
        <>
          <Loader />
          {outlet}
        </>
      )}
      {story.status === 'failed' && (
        <>
          <StoryFailed error={story.error} />
          {outlet}
        </>
      )}
      {loaded && index && (
        <>
          <Title order={2}>{loaded.title || 'Untitled story'}</Title>
          <ViewLinks storyId={loaded.id} search={location.search} />
          <Group align="flex-start" wrap="nowrap" gap="lg">
            <Box style={{ flex: '1 1 auto', minWidth: 0 }}>{outlet}</Box>
            {wide && selectedId && (
              <Paper
                withBorder
                p="md"
                w={340}
                style={{
                  flex: 'none',
                  position: 'sticky',
                  top: 8,
                  maxHeight: 'calc(100vh - 5rem)',
                  overflow: 'auto',
                }}
              >
                <DetailPanel
                  story={loaded}
                  index={index}
                  recordId={selectedId}
                  onSelect={selectRecord}
                  onClose={clearRecord}
                />
              </Paper>
            )}
          </Group>
          {!wide && (
            <Drawer
              position="right"
              size="md"
              opened={selectedId !== null}
              onClose={clearRecord}
              withCloseButton={false}
            >
              {selectedId && (
                <DetailPanel
                  story={loaded}
                  index={index}
                  recordId={selectedId}
                  onSelect={selectRecord}
                  onClose={clearRecord}
                />
              )}
            </Drawer>
          )}
        </>
      )}
    </Stack>
  )
}

/** `/stories/{id}` opens on the records view, at that view's own address. */
export function OpenRecords() {
  const { storyId } = useParams()
  const { search } = useLocation()
  return <Navigate to={{ pathname: `/stories/${storyId}/records`, search }} replace />
}

function ViewLinks({ storyId, search }: { storyId: string; search: string }) {
  return (
    <Group gap="md">
      {VIEWS.map((view) => (
        <ViewLink key={view.path} storyId={storyId} view={view} search={search} />
      ))}
    </Group>
  )
}

function ViewLink({
  storyId,
  view,
  search,
}: {
  storyId: string
  view: (typeof VIEWS)[number]
  search: string
}) {
  const match = useMatch(`/stories/:storyId/${view.path}`)
  return (
    <Anchor
      component={Link}
      to={{ pathname: `/stories/${storyId}/${view.path}`, search }}
      fw={match ? 700 : 500}
      underline={match ? 'always' : 'hover'}
      aria-current={match ? 'page' : undefined}
    >
      {view.label}
    </Anchor>
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
