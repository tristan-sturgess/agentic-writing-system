// Arranges a story's resolved Event times on the timeline: the moments, the
// stretches and how long each one is, the lanes, the marks, and the Events
// that have no place. The service has already resolved the times. Nothing
// here decides what a time point means.
//
// A timestamp is story-local and has no time zone. Years below 100 are real
// years, so the lengths are counted on the proleptic Gregorian calendar
// directly. `Date` cannot do that: it treats years 0 to 99 as 1900 to 1999.

import type { EventTimePoint, EventTimes, Story } from '../api/client'
import { references } from '../story/references'

export type Moment = {
  /** `YYYY-MM-DDTHH:MM:SS`, so two moments compare as text. */
  timestamp: string
  /** The timestamp as the story wrote it. */
  label: string
}

export type Stretch = {
  from: string
  to: string
  /** The story time between the two moments, such as "3 days" or "45 minutes". */
  label: string
}

/** One end of a mark. `edge` is null when the time was written as a timestamp. */
export type MarkEndpoint = {
  timestamp: string
  source: 'written' | 'derived'
  /** Present when `source` is `written`: the timestamp as stored. */
  written?: string
  /** Present when `source` is `derived`: the Event the time was taken from. */
  eventId?: string
  edge: 'start' | 'end' | null
}

export type Mark =
  | { kind: 'point'; spanIndex: number; at: MarkEndpoint }
  | { kind: 'bar'; spanIndex: number; start: MarkEndpoint; end: MarkEndpoint }
  | {
      kind: 'open'
      spanIndex: number
      at: MarkEndpoint
      /** `after` grows later from a known start. `before` grows earlier from a known end. */
      toward: 'after' | 'before'
    }

export type PlacedEvent = {
  eventId: string
  lane: number
  /** The moment the title sits beside: where the Event's first mark starts. */
  titleAt: string
  marks: Mark[]
}

export type UnplacedReason = {
  place: 'at' | 'start' | 'end'
  code: 'no_time' | 'several_spans' | 'bound_absent'
  /** The Events followed, ending at the one that stopped the chain. */
  eventIds: string[]
  edge: 'start' | 'end' | null
}

export type UnplacedEntry = {
  eventId: string
  /** Null when the Event's `when` list is empty. */
  spanIndex: number | null
  reasons: UnplacedReason[]
}

export type TimelineLayout = {
  moments: Moment[]
  stretches: Stretch[]
  laneCount: number
  placed: PlacedEvent[]
  timeUnspecified: UnplacedEntry[]
  notResolved: UnplacedEntry[]
  endsBeforeStart: UnplacedEntry[]
}

export type TimeSelection =
  | { kind: 'moment'; timestamp: string }
  | { kind: 'stretch'; from: string; to: string }

export type InProgress = {
  /** A point on the moment, or a bar that reaches or crosses the selection. */
  happening: string[]
  /** A start is recorded and the end is not. */
  begunNoEnd: string[]
  /** An end is recorded and the start is not. */
  endedNoStart: string[]
}

type Place = 'at' | 'start' | 'end'

type ReadPoint =
  | { ok: true; endpoint: MarkEndpoint }
  | { ok: false; reason: UnplacedReason }

/**
 * The timeline for one story.
 *
 * Moments are the distinct timestamps a placed point or bound resolves to,
 * in chronological order. A stretch is the gap between two neighbouring
 * moments. Two Events share a lane only when one is over before the other
 * begins: a shared moment is an overlap, and an open bar occupies only its
 * known moment, because the unknown bound is not the rest of the timeline.
 */
export function layOutTimeline(story: Story, times: EventTimes): TimelineLayout {
  const timesById = new Map(times.events.map((event) => [event.id, event]))
  const momentStamps = new Set<string>()
  const labels = new Map<string, string>()
  const drafted: {
    index: number
    eventId: string
    marks: Mark[]
  }[] = []
  const timeUnspecified: UnplacedEntry[] = []
  const notResolved: UnplacedEntry[] = []
  const endsBeforeStart: UnplacedEntry[] = []

  story.events.forEach((event, index) => {
    const entry = timesById.get(event.id)
    if (!entry || entry.spans.length === 0) {
      timeUnspecified.push({ eventId: event.id, spanIndex: null, reasons: [] })
      return
    }
    const marks: Mark[] = []
    entry.spans.forEach((span, spanIndex) => {
      if (span.kind === 'at') {
        const read = readPoint(span.at, 'at')
        if (read.ok === false) {
          notResolved.push({ eventId: event.id, spanIndex, reasons: [read.reason] })
          return
        }
        noteMoment(momentStamps, labels, read.endpoint)
        marks.push({ kind: 'point', spanIndex, at: read.endpoint })
        return
      }
      if (span.ends_before_start) {
        endsBeforeStart.push({ eventId: event.id, spanIndex, reasons: [] })
        return
      }
      const start = span.start ? readPoint(span.start, 'start') : null
      const end = span.end ? readPoint(span.end, 'end') : null
      const reasons = [start, end].flatMap((read) =>
        read !== null && read.ok === false ? [read.reason] : [],
      )
      if (reasons.length > 0) {
        notResolved.push({ eventId: event.id, spanIndex, reasons })
        return
      }
      if (!start && !end) {
        timeUnspecified.push({ eventId: event.id, spanIndex, reasons: [] })
        return
      }
      if (start?.ok && end?.ok) {
        noteMoment(momentStamps, labels, start.endpoint)
        noteMoment(momentStamps, labels, end.endpoint)
        marks.push({ kind: 'bar', spanIndex, start: start.endpoint, end: end.endpoint })
        return
      }
      const known = start?.ok ? start.endpoint : end?.ok ? end.endpoint : null
      if (!known) return
      noteMoment(momentStamps, labels, known)
      marks.push({
        kind: 'open',
        spanIndex,
        at: known,
        toward: start?.ok ? 'after' : 'before',
      })
    })
    if (marks.length > 0) drafted.push({ index, eventId: event.id, marks })
  })

  const timestamps = [...momentStamps].sort()
  const moments: Moment[] = timestamps.map((timestamp) => ({
    timestamp,
    label: labels.get(timestamp) ?? timestamp.replace('T', ' '),
  }))
  const stretches: Stretch[] = []
  for (let i = 0; i < timestamps.length - 1; i++) {
    const from = timestamps[i]
    const to = timestamps[i + 1]
    stretches.push({ from, to, label: lengthLabel(from, to) })
  }

  const indexOf = new Map(timestamps.map((timestamp, index) => [timestamp, index]))
  const candidates = drafted.map((event) => ({
    ...event,
    titleAt: earliest(event.marks),
    occupied: occupiedMoments(event.marks, indexOf),
  }))
  candidates.sort((a, b) => a.titleAt.localeCompare(b.titleAt) || a.index - b.index)

  const lanes: Set<number>[] = []
  const byLane = new Map<string, number>()
  for (const candidate of candidates) {
    let lane = lanes.findIndex((taken) => candidate.occupied.every((moment) => !taken.has(moment)))
    if (lane === -1) {
      lane = lanes.length
      lanes.push(new Set())
    }
    for (const moment of candidate.occupied) lanes[lane].add(moment)
    byLane.set(candidate.eventId, lane)
  }

  return {
    moments,
    stretches,
    laneCount: lanes.length,
    placed: drafted.map((event) => ({
      eventId: event.eventId,
      lane: byLane.get(event.eventId) ?? 0,
      titleAt: earliest(event.marks),
      marks: event.marks,
    })),
    timeUnspecified,
    notResolved,
    endsBeforeStart,
  }
}

/**
 * The Events in progress at a moment or across a stretch.
 *
 * An open bar is listed apart from the Events that are known to be happening.
 * It stays on its known moment: a missing bound is unknown, not ongoing, so
 * the bar does not cover later stretches by running to the edge.
 */
export function inProgress(layout: TimelineLayout, selection: TimeSelection): InProgress {
  const happening: string[] = []
  const begunNoEnd: string[] = []
  const endedNoStart: string[] = []
  for (const event of layout.placed) {
    let happens = false
    let begun = false
    let ended = false
    for (const mark of event.marks) {
      if (selection.kind === 'moment') {
        const at = selection.timestamp
        if (mark.kind === 'point' && mark.at.timestamp === at) happens = true
        if (mark.kind === 'bar' && mark.start.timestamp <= at && mark.end.timestamp >= at) {
          happens = true
        }
        if (mark.kind === 'open' && mark.toward === 'after' && mark.at.timestamp <= at) begun = true
        if (mark.kind === 'open' && mark.toward === 'before' && mark.at.timestamp >= at) {
          ended = true
        }
      } else if (mark.kind === 'bar') {
        if (mark.start.timestamp <= selection.from && mark.end.timestamp >= selection.to) {
          happens = true
        }
      } else if (mark.kind === 'open' && mark.toward === 'after') {
        if (mark.at.timestamp <= selection.from) begun = true
      } else if (mark.kind === 'open' && mark.toward === 'before') {
        if (mark.at.timestamp >= selection.to) ended = true
      }
    }
    if (happens) happening.push(event.eventId)
    if (begun) begunNoEnd.push(event.eventId)
    if (ended) endedNoStart.push(event.eventId)
  }
  return { happening, begunNoEnd, endedNoStart }
}

/**
 * The Event itself, the Events its time is taken from, and the Events whose
 * time is taken from it, following `when` as far as that chain goes.
 *
 * A sibling that names the same Event is left out. Moving this Event does not
 * move the sibling, and the sibling is not where this Event's time comes from.
 */
export function eventsLinkedByTime(story: Story, eventId: string): ReadonlySet<string> {
  const eventIds = new Set(story.events.map((event) => event.id))
  const dependsOn = new Map<string, string[]>()
  const dependedOnBy = new Map<string, string[]>()
  for (const ref of references(story)) {
    if (ref.field !== 'when' || !eventIds.has(ref.from) || !eventIds.has(ref.to)) continue
    const sources = dependsOn.get(ref.from)
    if (sources) sources.push(ref.to)
    else dependsOn.set(ref.from, [ref.to])
    const users = dependedOnBy.get(ref.to)
    if (users) users.push(ref.from)
    else dependedOnBy.set(ref.to, [ref.from])
  }
  const linked = new Set<string>()
  const walk = (nextOf: Map<string, string[]>) => {
    const pending = [eventId]
    const seen = new Set<string>()
    while (pending.length > 0) {
      const id = pending.pop()
      if (id === undefined || seen.has(id)) continue
      seen.add(id)
      linked.add(id)
      for (const next of nextOf.get(id) ?? []) pending.push(next)
    }
  }
  walk(dependsOn)
  walk(dependedOnBy)
  return linked
}

function readPoint(point: EventTimePoint, place: Place): ReadPoint {
  if (point.timestamp !== null) {
    const derived = 'event_id' in point.point
    return {
      ok: true,
      endpoint: {
        timestamp: point.timestamp,
        source: derived ? 'derived' : 'written',
        written: !derived && 'timestamp' in point.point ? point.point.timestamp : undefined,
        eventId: derived && 'event_id' in point.point ? point.point.event_id : undefined,
        edge: point.edge,
      },
    }
  }
  return {
    ok: false,
    reason: {
      place,
      code: point.unresolved?.code ?? 'no_time',
      eventIds: point.unresolved?.event_ids ?? [],
      edge: point.edge,
    },
  }
}

function noteMoment(moments: Set<string>, labels: Map<string, string>, endpoint: MarkEndpoint) {
  moments.add(endpoint.timestamp)
  // The first timestamp the story wrote for this moment is the label. A time
  // taken from another Event does not invent a second way to write it.
  if (endpoint.source !== 'written' || labels.has(endpoint.timestamp)) return
  labels.set(endpoint.timestamp, (endpoint.written ?? endpoint.timestamp).replace('T', ' '))
}

function earliest(marks: Mark[]): string {
  let best = ''
  for (const mark of marks) {
    const timestamp =
      mark.kind === 'bar'
        ? mark.start.timestamp < mark.end.timestamp
          ? mark.start.timestamp
          : mark.end.timestamp
        : mark.at.timestamp
    if (best === '' || timestamp < best) best = timestamp
  }
  return best
}

function occupiedMoments(marks: Mark[], indexOf: ReadonlyMap<string, number>): number[] {
  const taken = new Set<number>()
  for (const mark of marks) {
    if (mark.kind === 'bar') {
      const start = indexOf.get(mark.start.timestamp)
      const end = indexOf.get(mark.end.timestamp)
      if (start === undefined || end === undefined) continue
      for (let index = Math.min(start, end); index <= Math.max(start, end); index++) {
        taken.add(index)
      }
    } else {
      const index = indexOf.get(mark.at.timestamp)
      if (index !== undefined) taken.add(index)
    }
  }
  return [...taken]
}

type Civil = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function lengthLabel(from: string, to: string): string {
  return formatLength(between(parseTimestamp(from), parseTimestamp(to)))
}

function between(start: Civil, end: Civil): {
  years: number
  months: number
  days: number
  hours: number
  minutes: number
  seconds: number
} {
  let years = end.year - start.year
  if (compareCivil(addMonths(start, years * 12), end) > 0) years -= 1
  const afterYears = addMonths(start, years * 12)
  let months = (end.year - afterYears.year) * 12 + (end.month - afterYears.month)
  if (compareCivil(addMonths(afterYears, months), end) > 0) months -= 1
  const cursor = addMonths(afterYears, months)
  let days =
    daysFromCivil(end.year, end.month, end.day) -
    daysFromCivil(cursor.year, cursor.month, cursor.day)
  let hours = end.hour - cursor.hour
  let minutes = end.minute - cursor.minute
  let seconds = end.second - cursor.second
  if (seconds < 0) {
    seconds += 60
    minutes -= 1
  }
  if (minutes < 0) {
    minutes += 60
    hours -= 1
  }
  if (hours < 0) {
    hours += 24
    days -= 1
  }
  return { years, months, days, hours, minutes, seconds }
}

function formatLength(parts: {
  years: number
  months: number
  days: number
  hours: number
  minutes: number
  seconds: number
}): string {
  const bits = (
    [
      [parts.years, 'year'],
      [parts.months, 'month'],
      [parts.days, 'day'],
      [parts.hours, 'hour'],
      [parts.minutes, 'minute'],
      [parts.seconds, 'second'],
    ] as const
  ).flatMap(([count, unit]) => (count > 0 ? [`${count} ${unit}${count === 1 ? '' : 's'}`] : []))
  return bits.join(', ')
}

function parseTimestamp(value: string): Civil {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error(`A resolved timestamp must be YYYY-MM-DDTHH:MM:SS, not ${value}.`)
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  }
}

function compareCivil(left: Civil, right: Civil): number {
  return (
    left.year - right.year ||
    left.month - right.month ||
    left.day - right.day ||
    left.hour - right.hour ||
    left.minute - right.minute ||
    left.second - right.second
  )
}

function addMonths(start: Civil, count: number): Civil {
  const zeroBased = start.month - 1 + count
  const year = start.year + Math.floor(zeroBased / 12)
  const month = (zeroBased % 12) + 1
  return {
    ...start,
    year,
    month,
    day: Math.min(start.day, daysInMonth(year, month)),
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

function isLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/** Days since the civil epoch. Howard Hinnant's algorithm, for the difference only. */
function daysFromCivil(year: number, month: number, day: number): number {
  const shifted = month <= 2 ? year - 1 : year
  const era = Math.floor(shifted / 400)
  const yearOfEra = shifted - era * 400
  const dayOfYear =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}
