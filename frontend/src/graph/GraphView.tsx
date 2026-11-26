// The graph: every record, the references between them, and what connects to
// nothing. Cytoscape draws it. The layout runs once per story and once per
// Regenerate in the layout panel, so a filter or a new selection does not move
// the nodes.

import { Box, Chip, Group, Paper, Stack, Text, useMantineTheme, type MantineTheme } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'

import { useStory } from '../pages/storyContext'
import { indexRecords, type RecordKind } from '../story/records'
import { RecordLink } from '../story/parts'
import {
  DEFAULT_LAYOUT_SETTINGS,
  entityGroups,
  fcoseOptions,
  layoutSeed,
  seededPositions,
  withSeededRandom,
  type LayoutSettings,
} from './layout'
import { LayoutControls } from './LayoutControls'
import { graphOf, RECORD_KINDS, type GraphData, type GraphEdge } from './model'

cytoscape.use(fcose)

const NO_HIDDEN: ReadonlySet<RecordKind> = new Set()

const KIND_LABEL: Record<RecordKind, string> = {
  entity: 'Entities',
  property: 'Properties',
  assertion: 'Assertions',
  event: 'Events',
  unit: 'Narrative Units',
  arc: 'Arcs',
}

/** A Mantine palette entry. The node border and the chip use the same one. */
const KIND_PALETTE = {
  entity: 'blue',
  property: 'cyan',
  assertion: 'indigo',
  event: 'orange',
  unit: 'teal',
  arc: 'grape',
  story: 'gray',
} as const

type PaletteName = (typeof KIND_PALETTE)[keyof typeof KIND_PALETTE]
type NodeKind = keyof typeof KIND_PALETTE

/**
 * The graph for the open story.
 *
 * `?hide=` is the kinds that are hidden, comma-separated. It is absent when
 * every kind is shown. `?record=` is the selected record, the same detail
 * panel as the other views. The story node cannot be selected.
 */
export function GraphView() {
  const outlet = useStory()
  const story = outlet?.story
  const [params, setParams] = useSearchParams()
  const theme = useMantineTheme()
  const hideValue = params.get('hide')
  const [draft, setDraft] = useState<LayoutSettings>(DEFAULT_LAYOUT_SETTINGS)
  const [applied, setApplied] = useState<LayoutSettings>(DEFAULT_LAYOUT_SETTINGS)
  const hidden = useMemo(() => hiddenFromSearch(hideValue), [hideValue])
  const index = useMemo(() => (story ? indexRecords(story) : null), [story])
  const full = useMemo(
    () => (story && index ? graphOf(story, index, NO_HIDDEN) : null),
    [story, index],
  )
  const shown = useMemo(
    () => (story && index ? graphOf(story, index, hidden) : null),
    [story, index, hidden],
  )
  const selectedId = outlet?.selectedId ?? null
  const selectRecord = outlet?.selectRecord

  const storyId = story?.id
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const laidOutRef = useRef(false)
  const shownRef = useRef(shown)
  const selectedRef = useRef(selectedId)
  const selectRef = useRef(selectRecord)

  useEffect(() => {
    shownRef.current = shown
    selectedRef.current = selectedId
    selectRef.current = selectRecord
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || !full || !storyId) return
    // The screenshot command waits for this, and only a finished layout sets it.
    container.removeAttribute('data-layout')
    const seed = layoutSeed(storyId, applied.seed)
    let cancelled = false
    const cy = cytoscape({
      container,
      elements: elementsOf(full, seed),
      // The constructor's own layout is a grid, and that grid would replace the
      // seeded positions before fcose could read them. Preset keeps them.
      layout: { name: 'preset' },
      style: stylesheet(theme),
      minZoom: 0.08,
      maxZoom: 2.5,
      boxSelectionEnabled: false,
      autounselectify: true,
    })
    // About 15% per mouse-wheel notch, so a short spin reaches a record from
    // the fitted view. Set here because the constructor warns about any value
    // other than Cytoscape's own.
    ;(cy as unknown as { renderer(): { wheelSensitivity: number } }).renderer().wheelSensitivity = 5
    cyRef.current = cy
    cy.on('tap', 'node', (event) => {
      const node = event.target
      const kind = node.data('kind')
      if (kind === 'story' || kind === 'group') return
      selectRef.current?.(node.id())
    })
    cy.on('mouseover', 'edge', (event) => {
      event.target.addClass('hover')
    })
    cy.on('mouseout', 'edge', (event) => {
      event.target.removeClass('hover')
    })

    const layout = cy.layout({
      ...fcoseOptions(applied),
      stop: () => {
        if (cancelled || cy.destroyed()) return
        laidOutRef.current = true
        const visible = shownRef.current
        if (visible) applyVisibility(cy, visible)
        applySelection(cy, selectedRef.current)
        container.dataset.layout = 'done'
      },
    } as cytoscape.LayoutOptions)
    cy.resize()
    withSeededRandom(seed, () => layout.run())

    return () => {
      cancelled = true
      laidOutRef.current = false
      container.removeAttribute('data-layout')
      cy.destroy()
      cyRef.current = null
    }
  }, [full, theme, storyId, applied])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !laidOutRef.current || !shown) return
    applyVisibility(cy, shown)
  }, [shown])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !laidOutRef.current) return
    applySelection(cy, selectedId)
  }, [selectedId])

  if (!story || !index || !full || !shown || !selectRecord) return null

  const shownKinds = RECORD_KINDS.filter((kind) => !hidden.has(kind))
  const setShown = (value: string[]) => {
    const nextShown = new Set(value)
    const nextHidden = RECORD_KINDS.filter((kind) => !nextShown.has(kind))
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nextHidden.length === 0) next.delete('hide')
      else next.set('hide', nextHidden.join(','))
      return next
    })
  }

  // In the story's right-hand column when there is one, else under the graph.
  const sideSlot = outlet?.sideSlot ?? null
  const sidePaper = { withBorder: true, p: 'md', w: sideSlot ? 340 : undefined, ml: sideSlot ? 'lg' : 0 }
  const side = (
    <>
      <Paper {...sidePaper}>
        <UnconnectedList
          ids={full.unconnected}
          index={index}
          selectedId={selectedId}
          onSelect={selectRecord}
        />
      </Paper>
      <Paper {...sidePaper}>
        <LayoutControls
          value={draft}
          applied={applied}
          onChange={setDraft}
          onRegenerate={() => setApplied({ ...draft })}
        />
      </Paper>
    </>
  )

  return (
    <Stack gap="sm">
      <Group gap="xs" align="center">
        <Chip.Group multiple value={shownKinds} onChange={setShown}>
          <Group gap="xs">
            {RECORD_KINDS.map((kind) => (
              <Chip key={kind} value={kind} color={KIND_PALETTE[kind]} variant="outline" size="sm">
                <Swatch color={shade(theme, KIND_PALETTE[kind], 6)} />
                {KIND_LABEL[kind]} ({full.counts[kind]})
              </Chip>
            ))}
          </Group>
        </Chip.Group>
        <Group gap={6} wrap="nowrap">
          <Swatch color={shade(theme, KIND_PALETTE.story, 6)} />
          <Text size="sm">Story</Text>
        </Group>
      </Group>
      <Box
        ref={containerRef}
        aria-label="Record graph"
        style={{
          height: '70vh',
          minHeight: 420,
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-sm)',
        }}
      />
      {sideSlot ? createPortal(side, sideSlot) : side}
    </Stack>
  )
}

function UnconnectedList({
  ids,
  index,
  selectedId,
  onSelect,
}: {
  ids: string[]
  index: ReturnType<typeof indexRecords>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        Connects to nothing ({ids.length})
      </Text>
      {ids.length === 0 ? (
        <Text size="sm">Every record connects.</Text>
      ) : (
        RECORD_KINDS.map((kind) => {
          const group = ids.filter((id) => index.get(id)?.kind === kind)
          if (group.length === 0) return null
          return (
            <Stack key={kind} gap={2}>
              <Text size="xs" c="dimmed">
                {KIND_LABEL[kind]} ({group.length})
              </Text>
              {group.map((id) => (
                <RecordLink key={id} id={id} fw={id === selectedId ? 700 : undefined} onSelect={onSelect}>
                  {index.get(id)?.label}
                </RecordLink>
              ))}
            </Stack>
          )
        })
      )}
    </Stack>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <Box
      component="span"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        marginRight: 6,
        borderRadius: 2,
        background: color,
        verticalAlign: 'middle',
      }}
    />
  )
}

function hiddenFromSearch(value: string | null): Set<RecordKind> {
  const hidden = new Set<RecordKind>()
  if (!value) return hidden
  for (const part of value.split(',')) {
    const kind = part.trim()
    if (isRecordKind(kind)) hidden.add(kind)
  }
  return hidden
}

function isRecordKind(value: string): value is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(value)
}

function shade(theme: MantineTheme, name: PaletteName, index: 1 | 6): string {
  return theme.colors[name][index]
}

function elementsOf(graph: GraphData, seed: string): cytoscape.ElementDefinition[] {
  const unconnected = new Set(graph.unconnected)
  const positions = seededPositions(
    seed,
    graph.nodes.map((node) => node.id),
  )
  const groups = entityGroups(graph.nodes, graph.edges)
  const boxes: cytoscape.ElementDefinition[] = [...new Set(groups.values())].map((id) => ({
    data: { id, kind: 'group' },
  }))
  const nodes: cytoscape.ElementDefinition[] = graph.nodes.map((node) => ({
    data: { id: node.id, label: node.label, kind: node.kind, parent: groups.get(node.id) },
    position: positions.get(node.id),
    classes: node.kind !== 'story' && unconnected.has(node.id) ? 'unconnected' : '',
  }))
  const edges: cytoscape.ElementDefinition[] = graph.edges.map((edge) => ({
    data: {
      id: edgeElementId(edge),
      source: edge.from,
      target: edge.to,
      fields: edge.fields.join(', '),
    },
  }))
  return [...boxes, ...nodes, ...edges]
}

function edgeElementId(edge: GraphEdge): string {
  return `edge:${edge.from}\u0001${edge.to}`
}

function applyVisibility(cy: cytoscape.Core, shown: GraphData) {
  const nodeIds = new Set(shown.nodes.map((node) => node.id))
  const edgeIds = new Set(shown.edges.map(edgeElementId))
  cy.batch(() => {
    // Hiding a box hides everything in it, so a box stays while any member shows.
    cy.nodes().forEach((node) => {
      const show = node.isParent()
        ? node.children().filter((child) => nodeIds.has(child.id())).nonempty()
        : nodeIds.has(node.id())
      node.style('display', show ? 'element' : 'none')
    })
    cy.edges().forEach((edge) => {
      edge.style('display', edgeIds.has(edge.id()) ? 'element' : 'none')
    })
  })
}

function applySelection(cy: cytoscape.Core, selectedId: string | null) {
  cy.batch(() => {
    cy.elements().removeClass('emphasized')
    if (!selectedId) return
    const node = cy.getElementById(selectedId)
    if (node.empty()) return
    node.addClass('emphasized')
    node.connectedEdges().addClass('emphasized')
  })
}

function stylesheet(theme: MantineTheme): cytoscape.StylesheetJson {
  const kindRules: cytoscape.StylesheetJson = (Object.keys(KIND_PALETTE) as NodeKind[]).map((kind) => ({
    selector: `node[kind = "${kind}"]`,
    style: {
      'background-color': shade(theme, KIND_PALETTE[kind], 1),
      'border-color': shade(theme, KIND_PALETTE[kind], 6),
    },
  }))
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-wrap': 'wrap',
        'text-max-width': '108px',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': 10,
        color: theme.black,
        shape: 'round-rectangle',
        width: 'label',
        height: 'label',
        padding: '7px',
        'border-width': 2,
        'border-style': 'solid',
      },
    },
    ...kindRules,
    {
      selector: 'node[kind = "group"]',
      style: {
        label: '',
        'background-color': shade(theme, KIND_PALETTE.entity, 1),
        'background-opacity': 0.35,
        'border-color': shade(theme, KIND_PALETTE.entity, 6),
        'border-width': 1,
        'border-opacity': 0.5,
        padding: '12px',
      },
    },
    {
      selector: 'node.unconnected',
      style: { 'border-style': 'dashed', 'border-width': 3 },
    },
    {
      selector: 'node.emphasized',
      style: {
        'border-width': 4,
        'overlay-color': theme.colors.yellow[5],
        'overlay-opacity': 0.35,
        'overlay-padding': 6,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.25,
        'curve-style': 'bezier',
        'line-color': theme.colors.gray[5],
        'target-arrow-color': theme.colors.gray[6],
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.8,
        label: '',
        'font-size': 9,
        color: theme.colors.gray[8],
        'text-background-color': theme.white,
        'text-background-opacity': 0.9,
        'text-background-padding': '2px',
      },
    },
    {
      selector: 'edge.hover, edge.emphasized',
      style: {
        label: 'data(fields)',
        width: 2.4,
        'line-color': theme.colors.gray[8],
        'target-arrow-color': theme.colors.gray[8],
      },
    },
  ]
}
