import { Tabs } from '@mantine/core'
import { useMemo } from 'react'

import { ArcsSection } from '../story/ArcsSection'
import { AssertionsSection } from '../story/AssertionsSection'
import { EntitiesSection } from '../story/EntitiesSection'
import { EventsSection } from '../story/EventsSection'
import { FramingSection } from '../story/FramingSection'
import { indexRecords } from '../story/records'
import { UnitsSection } from '../story/UnitsSection'
import { useStory } from './storyContext'

/** The records view: every field of every record, as stored. */
export function RecordsView() {
  const outlet = useStory()
  const story = outlet?.story
  const index = useMemo(() => (story ? indexRecords(story) : null), [story])
  if (!outlet || !story || !index) return null
  const { selectRecord } = outlet
  return (
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
        <EntitiesSection story={story} index={index} onSelect={selectRecord} />
      </Tabs.Panel>
      <Tabs.Panel value="events" pt="md">
        <EventsSection story={story} index={index} onSelect={selectRecord} />
      </Tabs.Panel>
      <Tabs.Panel value="arcs" pt="md">
        <ArcsSection story={story} index={index} onSelect={selectRecord} />
      </Tabs.Panel>
      <Tabs.Panel value="assertions" pt="md">
        <AssertionsSection story={story} index={index} onSelect={selectRecord} />
      </Tabs.Panel>
      <Tabs.Panel value="units" pt="md">
        <UnitsSection story={story} index={index} onSelect={selectRecord} />
      </Tabs.Panel>
    </Tabs>
  )
}
