import {
  Alert,
  Anchor,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  Navigate,
  Outlet,
  useBlocker,
  useLocation,
  useMatch,
  useParams,
  useSearchParams,
  type BlockerFunction,
} from 'react-router'

import { ApiError, describeFailure, getStory } from '../api/client'
import { CreatePanel, type CreateRequest } from '../story/CreatePanel'
import { DetailPanel } from '../story/DetailPanel'
import { indexRecords } from '../story/records'
import { useReloadableLoad } from '../useLoad'
import type { StoryOutlet } from './storyContext'

// A view is added here when its screen exists. This page does not link to a
// view that has no screen.
const VIEWS = [
  { path: 'records', label: 'Records' },
  { path: 'timeline', label: 'Timeline' },
  { path: 'entities', label: 'Entities' },
  { path: 'graph', label: 'Graph' },
] as const

type Pending =
  | { kind: 'select'; id: string }
  | { kind: 'close' }
  | { kind: 'create'; request: CreateRequest }

/**
 * One story, loaded once for every view under it.
 *
 * `/stories/{id}` redirects to the records view. The selected record is
 * `?record=`, and the view links keep it, so it survives a reload and a
 * change of view. The detail panel lives here, so an edit survives a change
 * of view too.
 */
export function StoryLayout() {
  const { storyId = '' } = useParams()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const load = useCallback(() => getStory(storyId), [storyId])
  const [story, reloadStory] = useReloadableLoad(load)
  const [reloadError, setReloadError] = useState<{ id: string; error: Error } | null>(null)
  const [createState, setCreateState] = useState<{
    storyId: string
    request: CreateRequest
  } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<{ id: string; action: Pending } | null>(null)
  const dirtyRef = useRef(false)
  const theme = useMantineTheme()
  const wide = useMediaQuery(`(min-width: ${theme.breakpoints.md})`, true, {
    getInitialValueInEffect: false,
  })

  const selectedId = params.get('record')
  const creating = createState?.storyId === storyId ? createState.request : null
  const action = pending?.id === storyId ? pending.action : null
  const reloadFailure = reloadError?.id === storyId ? reloadError.error : null

  // A failed reload is reported here and leaves the story already on screen.
  const reload = useCallback(async () => {
    try {
      await reloadStory()
      setReloadError(null)
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      setReloadError({ id: storyId, error })
    }
  }, [reloadStory, storyId])
  const stopCreating = useCallback(() => setCreateState(null), [])

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

  const onDirtyChange = useCallback((next: boolean) => {
    dirtyRef.current = next
    setDirty(next)
  }, [])

  // Leaving the story is a navigation. Changing view or query stays on this
  // page, and the panel stays mounted, so that navigation is left alone.
  const shouldBlock = useCallback<BlockerFunction>(
    ({ nextLocation }) => {
      if (!dirtyRef.current) return false
      const base = `/stories/${storyId}`
      return nextLocation.pathname !== base && !nextLocation.pathname.startsWith(`${base}/`)
    },
    [storyId],
  )
  const blocker = useBlocker(shouldBlock)

  const requestSelect = useCallback(
    (id: string) => {
      if (dirtyRef.current && (creating || id !== selectedId)) {
        setPending({ id: storyId, action: { kind: 'select', id } })
        return
      }
      stopCreating()
      selectRecord(id)
    },
    [creating, selectedId, selectRecord, stopCreating, storyId],
  )
  const requestClose = useCallback(() => {
    if (dirtyRef.current) {
      setPending({ id: storyId, action: { kind: 'close' } })
      return
    }
    stopCreating()
    clearRecord()
  }, [clearRecord, stopCreating, storyId])
  const beginCreate = useCallback(
    (request: CreateRequest) => {
      if (creating && createKey(creating) === createKey(request)) return
      if (dirtyRef.current) {
        setPending({ id: storyId, action: { kind: 'create', request } })
        return
      }
      setCreateState({ storyId, request })
    },
    [creating, storyId],
  )

  useEffect(() => {
    if (!dirty) return
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  function keepEditing() {
    setPending(null)
    if (blocker.state === 'blocked') blocker.reset()
  }

  function discardEdit() {
    dirtyRef.current = false
    setDirty(false)
    const chosen = action
    setPending(null)
    if (blocker.state === 'blocked') {
      stopCreating()
      blocker.proceed()
      return
    }
    if (chosen?.kind === 'select') {
      stopCreating()
      selectRecord(chosen.id)
    } else if (chosen?.kind === 'close') {
      stopCreating()
      clearRecord()
    } else if (chosen?.kind === 'create') {
      setCreateState({ storyId, request: chosen.request })
    }
  }

  const [sideSlot, setSideSlot] = useState<HTMLElement | null>(null)

  const loaded = story.status === 'loaded' ? story.data : null
  const index = loaded ? indexRecords(loaded) : null
  const outlet = loaded ? (
    <Outlet
      context={
        {
          story: loaded,
          selectedId,
          selectRecord: requestSelect,
          sideSlot: wide ? sideSlot : null,
          reload,
          beginCreate,
        } satisfies StoryOutlet
      }
    />
  ) : (
    <Outlet context={null} />
  )

  const panel =
    loaded && index && creating ? (
      <CreatePanel
        key={createKey(creating)}
        request={creating}
        story={loaded}
        index={index}
        onSelect={requestSelect}
        onClose={requestClose}
        onDirtyChange={onDirtyChange}
        onCancel={stopCreating}
        onReload={reload}
        onCreated={(id) => {
          stopCreating()
          if (id) selectRecord(id)
        }}
      />
    ) : loaded && index && selectedId ? (
      <DetailPanel
        story={loaded}
        index={index}
        recordId={selectedId}
        onSelect={requestSelect}
        onClose={requestClose}
        onRemoved={clearRecord}
        onReload={reload}
        onDirtyChange={onDirtyChange}
      />
    ) : null

  const asking = action !== null || blocker.state === 'blocked'

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
          {reloadFailure && (
            <Alert color="red" title="The story could not be loaded again">
              {describeFailure(reloadFailure)}
            </Alert>
          )}
          <ViewLinks storyId={loaded.id} search={location.search} />
          <Group align="flex-start" wrap="nowrap" gap={0}>
            <Box style={{ flex: '1 1 auto', minWidth: 0 }}>{outlet}</Box>
            {wide && (
              // Each part of this column carries its own left margin, so the
              // column takes no room while it is empty.
              <Stack
                gap="md"
                style={{
                  flex: 'none',
                  position: 'sticky',
                  top: 8,
                  maxHeight: 'calc(100vh - 5rem)',
                  overflow: 'auto',
                }}
              >
                {panel && (
                  <Paper withBorder p="md" w={340} ml="lg">
                    {panel}
                  </Paper>
                )}
                <Stack gap="md" ref={setSideSlot} />
              </Stack>
            )}
          </Group>
          {!wide && (
            <Drawer
              position="right"
              size="md"
              opened={panel !== null}
              onClose={requestClose}
              withCloseButton={false}
            >
              {panel}
            </Drawer>
          )}
        </>
      )}
      <Modal opened={asking} onClose={keepEditing} title="Discard this edit?">
        <Stack gap="md">
          <Text size="sm">This edit has not been saved.</Text>
          <Group gap="xs" wrap="wrap">
            <Button type="button" color="red" onClick={discardEdit}>
              Discard
            </Button>
            <Button type="button" variant="default" onClick={keepEditing}>
              Keep editing
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

/** Two requests for the same create are one create, so a second click does not reset the form. */
function createKey(request: CreateRequest): string {
  return JSON.stringify(request)
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
