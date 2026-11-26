import { useOutletContext } from 'react-router'

import type { Story } from '../api/client'

export type StoryOutlet = {
  story: Story
  selectedId: string | null
  selectRecord: (id: string) => void
  /**
   * The right-hand column under the detail panel, for a view to portal its
   * side content into. Null on a narrow screen, where there is no column.
   */
  sideSlot: HTMLElement | null
}

/** The story loaded by the story layout. Null while that load has not settled. */
export function useStory(): StoryOutlet | null {
  return useOutletContext<StoryOutlet | null>()
}
