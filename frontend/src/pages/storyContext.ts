import { useOutletContext } from 'react-router'

import type { Story } from '../api/client'
import type { CreateRequest } from '../story/CreatePanel'

export type StoryOutlet = {
  story: Story
  selectedId: string | null
  selectRecord: (id: string) => void
  /**
   * The right-hand column under the detail panel, for a view to portal its
   * side content into. Null on a narrow screen, where there is no column.
   */
  sideSlot: HTMLElement | null
  /** Load the story again after a save, and the views load story time again from its new `updated_at`. */
  reload: () => Promise<void>
  /** Open the create form for the requested kind in the detail panel. */
  beginCreate: (request: CreateRequest) => void
  /**
   * Report that a form has unsaved edits. The panel and the framing tab are
   * separate, so one clearing does not drop the other's edit.
   */
  setDirtySource: (source: string, dirty: boolean) => void
}

/** The story loaded by the story layout. Null while that load has not settled. */
export function useStory(): StoryOutlet | null {
  return useOutletContext<StoryOutlet | null>()
}
