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

/** The first sentence of a schema error, without the validator's prefix. */
function schemaMessage(detail: unknown): string | null {
  if (!Array.isArray(detail) || detail.length === 0) return null
  const first: unknown = detail[0]
  if (typeof first !== 'object' || first === null || !('msg' in first)) return null
  if (typeof first.msg !== 'string' || first.msg === '') return null
  const prefix = 'Value error, '
  return first.msg.startsWith(prefix) ? first.msg.slice(prefix.length) : first.msg
}

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

/**
 * The API's `404` and `503` bodies are `{ "detail": "one sentence" }`.
 * A `400` is `{ "detail": [{ "msg": "..." }] }`, and the first message is the reason.
 */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'detail' in body) {
      if (typeof body.detail === 'string') return body.detail
      const message = schemaMessage(body.detail)
      if (message) return message
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

export type StatementTimes = Schemas['StatementTimes']
export type StatementTime = Schemas['StatementTime']
export type InForce = Schemas['InForce']
export type InForceStatement = Schemas['InForceStatement']
export type UnresolvedComparison = Schemas['UnresolvedComparison']

/** What the service resolved for each Property and Assertion span. */
export function getStatementTimes(storyId: string): Promise<StatementTimes> {
  return get(`/stories/${encodeURIComponent(storyId)}/statement-times`)
}

/** A query point for the in-force read: a timestamp, or one end of an Event. */
export type InForceRequest =
  | { timestamp: string }
  | { eventId: string; edge: 'start' | 'end' }

/** The statements in force at one story time. A caller that names a time uses this. */
export function getInForce(storyId: string, query: InForceRequest): Promise<InForce> {
  const params = new URLSearchParams()
  if ('timestamp' in query) {
    params.set('timestamp', query.timestamp)
  } else {
    params.set('event_id', query.eventId)
    params.set('edge', query.edge)
  }
  return get(`/stories/${encodeURIComponent(storyId)}/in-force?${params.toString()}`)
}

export type InForceStretches = Schemas['InForceStretches']
export type InForceStretch = Schemas['InForceStretch']

/** The stretches in which one Entity's in-force set stays the same. */
export function getInForceStretches(storyId: string, entityId: string): Promise<InForceStretches> {
  const params = new URLSearchParams({ entity_id: entityId })
  return get(`/stories/${encodeURIComponent(storyId)}/in-force-stretches?${params.toString()}`)
}

export type Write = Schemas['Write']
export type UpdateWrite = Schemas['UpdateWrite']
export type Committed = Schemas['Committed']
export type Refusal = Schemas['Refusal']
export type Problem = Schemas['Problem']
export type ConflictResponse = Schemas['ConflictResponse']
export type ConflictRowView = Schemas['ConflictRowView']

/** What a save can come back as. Anything else is thrown, as `get` throws. */
export type CommitOutcome =
  | { status: 'committed'; result: Committed }
  | { status: 'refused'; refusal: Refusal }
  | { status: 'conflict'; conflict: ConflictResponse }
  | { status: 'busy'; message: string }

/**
 * One commit. The four outcomes the screen holds an edit through are tagged.
 * A story that is gone, or a body the schema rejects, is thrown.
 */
export async function postCommit(storyId: string, writes: readonly Write[]): Promise<CommitOutcome> {
  const response = await fetch(`/api/stories/${encodeURIComponent(storyId)}/commits`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  })
  if (response.status === 200) {
    return { status: 'committed', result: (await response.json()) as Committed }
  }
  if (response.status === 422) {
    return { status: 'refused', refusal: (await response.json()) as Refusal }
  }
  if (response.status === 409) {
    return { status: 'conflict', conflict: (await response.json()) as ConflictResponse }
  }
  if (response.status === 503) {
    return { status: 'busy', message: await errorMessage(response) }
  }
  throw new ApiError(response.status, await errorMessage(response))
}
