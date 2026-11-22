// The panel for trying fcose settings on the graph. Edits wait for Regenerate,
// and Copy puts the settings of the layout on screen on the clipboard as JSON.

import {
  Accordion,
  Button,
  CopyButton,
  Group,
  NumberInput,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { Fragment } from 'react'

import {
  DEFAULT_LAYOUT_SETTINGS,
  LAYOUT_KINDS,
  type KindSettings,
  type LayoutKind,
  type LayoutSettings,
  type LineSettings,
} from './layout'

type NumberKey = {
  [K in keyof LayoutSettings]: LayoutSettings[K] extends number ? K : never
}[keyof LayoutSettings]

type SwitchKey = {
  [K in keyof LayoutSettings]: LayoutSettings[K] extends boolean ? K : never
}[keyof LayoutSettings]

type Range = { label: string; min: number; max: number; step: number }

/** The slider's range. The number field beside it takes any value. */
const NUMBER_FIELDS: (Range & { key: NumberKey })[] = [
  { key: 'seed', label: 'Seed (start positions)', min: 0, max: 50, step: 1 },
  { key: 'boxRepulsion', label: 'Box repulsion', min: 0, max: 200000, step: 500 },
  { key: 'nestingFactor', label: 'Nesting factor', min: 0, max: 5, step: 0.05 },
  { key: 'gravity', label: 'Gravity', min: 0, max: 2, step: 0.01 },
  { key: 'gravityRange', label: 'Gravity range', min: 0.1, max: 20, step: 0.1 },
  { key: 'gravityCompound', label: 'Gravity in boxes', min: 0, max: 10, step: 0.05 },
  { key: 'gravityRangeCompound', label: 'Gravity range in boxes', min: 0.1, max: 20, step: 0.1 },
  { key: 'initialEnergyOnIncremental', label: 'Initial energy', min: 0, max: 1, step: 0.01 },
  { key: 'numIter', label: 'Iterations', min: 100, max: 20000, step: 100 },
  { key: 'nodeSeparation', label: 'Node separation (spectral)', min: 10, max: 1000, step: 5 },
  { key: 'sampleSize', label: 'Sample size (spectral)', min: 5, max: 200, step: 1 },
  { key: 'tilingPaddingVertical', label: 'Tiling padding, vertical', min: 0, max: 200, step: 1 },
  { key: 'tilingPaddingHorizontal', label: 'Tiling padding, horizontal', min: 0, max: 200, step: 1 },
]

const KIND_FIELDS: (Range & { key: keyof KindSettings })[] = [
  { key: 'nodeRepulsion', label: 'Node repulsion', min: 0, max: 200000, step: 500 },
  { key: 'idealEdgeLength', label: 'Ideal line length', min: 5, max: 1000, step: 5 },
  { key: 'edgeElasticity', label: 'Line elasticity', min: 0, max: 2, step: 0.01 },
]

const LINE_FIELDS = KIND_FIELDS.filter(
  (field): field is Range & { key: keyof LineSettings } => field.key !== 'nodeRepulsion',
)

const KIND_TITLE: Record<LayoutKind, string> = {
  entity: 'Entities',
  property: 'Properties',
  assertion: 'Assertions',
  event: 'Events',
  unit: 'Narrative Units',
  arc: 'Arcs',
  story: 'Story',
}

const SWITCH_FIELDS: { key: SwitchKey; label: string }[] = [
  { key: 'randomize', label: 'Randomize (spectral start instead of the seeded start)' },
  { key: 'tile', label: 'Tile unconnected nodes in boxes' },
  { key: 'nodeDimensionsIncludeLabels', label: 'Node size includes labels' },
  { key: 'uniformNodeDimensions', label: 'Uniform node sizes' },
]

export function LayoutControls({
  value,
  applied,
  onChange,
  onRegenerate,
}: {
  value: LayoutSettings
  applied: LayoutSettings
  onChange: (next: LayoutSettings) => void
  onRegenerate: () => void
}) {
  const set = <K extends keyof LayoutSettings>(key: K, next: LayoutSettings[K]) =>
    onChange({ ...value, [key]: next })
  const setKind = (kind: LayoutKind, key: keyof KindSettings, next: number) =>
    set('kinds', { ...value.kinds, [kind]: { ...value.kinds[kind], [key]: next } })

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Button size="xs" onClick={onRegenerate}>
          Regenerate
        </Button>
        <CopyButton value={JSON.stringify(applied, null, 2)}>
          {({ copied, copy }) => (
            <Button size="xs" variant="light" color={copied ? 'teal' : undefined} onClick={copy}>
              {copied ? 'Copied' : 'Copy settings'}
            </Button>
          )}
        </CopyButton>
        <Button size="xs" variant="subtle" onClick={() => onChange(DEFAULT_LAYOUT_SETTINGS)}>
          Defaults
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Copy takes the settings of the layout on screen, not edits waiting for Regenerate.
      </Text>

      <Stack gap={2}>
        <Text size="sm">Quality</Text>
        <SegmentedControl
          size="xs"
          value={value.quality}
          onChange={(next) => set('quality', next as LayoutSettings['quality'])}
          data={['draft', 'default', 'proof']}
        />
        {!value.randomize && value.quality !== 'proof' && (
          <Text size="xs" c="orange">
            fcose needs proof quality when randomize is off.
          </Text>
        )}
      </Stack>

      {SWITCH_FIELDS.map(({ key, label }) => (
        <Switch
          key={key}
          size="xs"
          label={label}
          checked={value[key]}
          onChange={(event) => set(key, event.currentTarget.checked)}
        />
      ))}

      <Stack gap={2}>
        <Text size="sm" fw={600}>
          By kind
        </Text>
        <Text size="xs" c="dimmed">
          A line takes its length and elasticity from the record it starts at, the one holding the
          reference. A Property&apos;s settings set the line to its Entity.
        </Text>
      </Stack>
      <Accordion multiple variant="contained" chevronPosition="left">
        {LAYOUT_KINDS.map((kind) => (
          <Accordion.Item key={kind} value={kind}>
            <Accordion.Control>
              <Text size="sm">{KIND_TITLE[kind]}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {kind === 'entity' && (
                  <Text size="xs" c="dimmed">
                    No line starts at an Entity, so only repulsion applies.
                  </Text>
                )}
                {KIND_FIELDS.filter(({ key }) => kind !== 'entity' || key === 'nodeRepulsion').map(
                  (field) => (
                    <Fragment key={field.key}>
                      {kind === 'property' && field.key === 'idealEdgeLength' && (
                        <>
                          <Text size="xs" fw={600}>
                            Line to its Entity (entity_id)
                          </Text>
                          {LINE_FIELDS.map((line) => (
                            <NumberRow
                              key={line.key}
                              {...line}
                              value={value.propertyToEntity[line.key]}
                              onChange={(next) =>
                                set('propertyToEntity', { ...value.propertyToEntity, [line.key]: next })
                              }
                            />
                          ))}
                          <Text size="xs" fw={600}>
                            Other lines (caused_by, when)
                          </Text>
                        </>
                      )}
                      <NumberRow
                        {...field}
                        value={value.kinds[kind][field.key]}
                        onChange={(next) => setKind(kind, field.key, next)}
                      />
                    </Fragment>
                  ),
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      {NUMBER_FIELDS.map((field) => (
        <NumberRow
          key={field.key}
          {...field}
          value={value[field.key]}
          onChange={(next) => set(field.key, next)}
        />
      ))}
    </Stack>
  )
}

function NumberRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: Range & { value: number; onChange: (next: number) => void }) {
  return (
    <Stack gap={2}>
      <Text size="sm">{label}</Text>
      <Group gap="xs" wrap="nowrap">
        <Slider
          style={{ flex: 1 }}
          size="sm"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={onChange}
          label={null}
        />
        <NumberInput
          size="xs"
          w={90}
          value={value}
          step={step}
          hideControls
          onChange={(next) => {
            if (typeof next === 'number') onChange(next)
          }}
        />
      </Group>
    </Stack>
  )
}
