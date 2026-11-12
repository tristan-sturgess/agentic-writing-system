import { Stack, Text } from '@mantine/core'

import type { Story } from '../api/client'
import { Empty, Prose } from './parts'

const FIELDS = [
  ['description', 'Description'],
  ['premise', 'Premise'],
  ['tone', 'Tone'],
  ['themes', 'Themes'],
  ['writing_style', 'Writing style'],
] as const

export function FramingSection({ story }: { story: Story }) {
  return (
    <Stack gap="md">
      {FIELDS.map(([field, label]) => (
        <div key={field}>
          <Text fw={600} size="sm">
            {label}
          </Text>
          {story[field] ? <Prose>{story[field]}</Prose> : <Empty>Not set</Empty>}
        </div>
      ))}
    </Stack>
  )
}
