// The frontend's calls to the Python API. The payload types come from
// `schema.d.ts`, which is generated from the service's OpenAPI document
// (`npm run api-types`), so nothing here restates the contract by hand.

import type { components } from './schema'

type Schemas = components['schemas']

export type StorySummary = Schemas['StorySummary']
export type Story = Schemas['StoryView']
export type Entity = Schemas['EntityView']
export type Property = Schemas['PropertyView']
export type Assertion = Schemas['AssertionView']
/** Named `StoryEvent` because `Event` is the browser's own type. */
export type StoryEvent = Schemas['EventView']
export type NarrativeUnit = Schemas['NarrativeUnitView']
export type Arc = Schemas['ArcView']
export type Span = Schemas['AtSpan'] | Schemas['RangeSpan']
export type TimePoint = Schemas['TimestampPoint'] | Schemas['EventPoint']

/** The API answered, with a status that is not a success. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const NO_ANSWER = 'The service did not answer. Check that it is running.'

/** One sentence for the screen about a call that failed. */
export function describeFailure(error: Error): string {
  if (error instanceof ApiError) {
    return error.message
  }
  // `fetch` rejects when no response came back at all.
  return NO_ANSWER
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response))
  }
  return (await response.json()) as T
}

/** The API's `404` and `503` bodies are `{ "detail": "one sentence" }`. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      return body.detail
    }
  } catch {
    // Not JSON, so not the API's own body.
  }
  // The dev server's proxy answers for a service that is down or too slow.
  if (response.status === 502 || response.status === 504) {
    return NO_ANSWER
  }
  return `The service answered ${response.status}.`
}

export function listStories(): Promise<StorySummary[]> {
  return get('/stories')
}

export function getStory(storyId: string): Promise<Story> {
  return get(`/stories/${encodeURIComponent(storyId)}`)
}

export type EventTimes = Schemas['EventTimes']
export type EventTime = Schemas['EventTime']
export type EventTimePoint = Schemas['EventTimePoint']

/** What the service resolved for each Event's spans. The timeline draws this. */
export function getEventTimes(storyId: string): Promise<EventTimes> {
  return get(`/stories/${encodeURIComponent(storyId)}/event-times`)
}
