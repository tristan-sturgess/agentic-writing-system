// Building the writes a save sends, and reading a refusal or a conflict back.
// The commit treats a field left out of an update as unchanged, so an update
// names only the fields that differ from what the panel loaded.

import type { Committed, ConflictRowView, Problem, Span, UpdateWrite, Write } from '../api/client'
import { primaryText } from './records'

export type EntityDraft = {
  name: string
  notes: string
}

export type UpdateKind = UpdateWrite['kind']

/** The fields an update of that kind may change. */
export type Patch<K extends UpdateKind> = Partial<Extract<UpdateWrite, { kind: K }>['fields']>

/**
 * The update for one record, or null when the draft matches the stored fields.
 * `base` is the record as it was when editing began, so the revision and the
 * comparison both come from what the writer started from.
 */
export function recordUpdate<K extends UpdateKind>(
  kind: K,
  base: { id: string; revision: number } & Patch<K>,
  draft: Patch<K>,
): Write | null {
  const stored = base as Record<string, unknown>
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined) continue
    if (!sameValue(value, stored[key])) fields[key] = value
  }
  if (Object.keys(fields).length === 0) return null
  // The generated patch types mark every field with a default as required.
  // The JSON must omit the fields the writer did not change, or a later save
  // against a new revision would write the stale value back over someone
  // else's edit of that field.
  return { op: 'update', kind, id: base.id, revision: base.revision, fields } as Write
}

/**
 * Two field values are the same when they hold the same data. Arrays compare
 * in order, because the order of a `when` list or an Arc's Events is part of
 * the record. Object keys compare in any order, and a key that is absent is the
 * same as one that is null, so `{ event_id }` and `{ event_id, edge: null }`
 * are one time point.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, position) => sameValue(item, b[position]))
  }
  if (typeof a !== 'object' || typeof b !== 'object') return false
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if (!sameValue(left[key], right[key])) return false
  }
  return true
}

/**
 * The label a create form gives the record it creates. A commit can carry
 * more than one create, so the new record is found by this label, not by
 * its place in the response.
 */
export const CREATED_REF = 'created'

export function entityCreate(draft: EntityDraft): Write {
  return {
    op: 'create',
    kind: 'entity',
    ref: CREATED_REF,
    fields: { name: draft.name, notes: draft.notes },
  }
}

export type PropertyDraftFields = {
  statement: string
  when: Span[]
  caused_by: string | null
}

export function propertyCreate(entityId: string, draft: PropertyDraftFields): Write {
  return {
    op: 'create',
    kind: 'property',
    ref: CREATED_REF,
    fields: {
      entity_id: entityId,
      statement: draft.statement,
      when: draft.when,
      caused_by: draft.caused_by,
    },
  }
}

export type EventDraftFields = {
  title: string
  description: string
  entity_ids: string[]
  when: Span[]
}

export function eventCreate(draft: EventDraftFields): Write {
  return {
    op: 'create',
    kind: 'event',
    ref: CREATED_REF,
    fields: {
      title: draft.title,
      description: draft.description,
      entity_ids: draft.entity_ids,
      when: draft.when,
    },
  }
}

export type ArcDraftFields = {
  title: string
  description: string
  event_ids: string[]
}

export function arcCreate(draft: ArcDraftFields): Write {
  return {
    op: 'create',
    kind: 'arc',
    ref: CREATED_REF,
    fields: {
      title: draft.title,
      description: draft.description,
      event_ids: draft.event_ids,
    },
  }
}

export type AssertionDraftFields = {
  statement: string
  entity_ids: string[]
  event_ids: string[]
  arc_ids: string[]
  when: Span[]
  caused_by: string | null
}

export function assertionCreate(draft: AssertionDraftFields): Write {
  return {
    op: 'create',
    kind: 'assertion',
    ref: CREATED_REF,
    fields: {
      statement: draft.statement,
      entity_ids: draft.entity_ids,
      event_ids: draft.event_ids,
      arc_ids: draft.arc_ids,
      when: draft.when,
      caused_by: draft.caused_by,
    },
  }
}

const FRAMING_FIELDS = ['title', 'description', 'premise', 'tone', 'themes', 'writing_style'] as const

export type FramingDraft = Record<(typeof FRAMING_FIELDS)[number], string>

/** The framing fields that changed, as one `set_story`. Null when nothing changed. */
export function framingUpdate(
  base: { revision: number } & FramingDraft,
  draft: FramingDraft,
): Write | null {
  const fields: Record<string, string> = {}
  for (const key of FRAMING_FIELDS) {
    if (draft[key] !== base[key]) fields[key] = draft[key]
  }
  if (Object.keys(fields).length === 0) return null
  // The generated patch marks every framing field required because each has a
  // default. The JSON must omit the ones the writer did not change.
  return { op: 'set_story', revision: base.revision, fields } as unknown as Write
}

/** The id the commit minted for the create that carried `ref`. */
export function createdId(committed: Committed, ref: string): string | null {
  return committed.created.find((item) => item.ref === ref)?.id ?? null
}

/** The delete of any record, at the revision the panel loaded. */
export function recordDelete(record: { id: string; revision: number }): Write {
  return { op: 'delete', id: record.id, revision: record.revision }
}

/** One problem as the text shown on its field, including the legal ids. */
export function problemMessage(problem: Problem): string {
  if (problem.legal_ids.length === 0) return problem.message
  return `${problem.message} Legal ids: ${problem.legal_ids.join(', ')}.`
}

/**
 * The problems that name a field of `recordId`, in the order the fields first appear.
 * A problem with no field is left for the refusal message. A problem that names
 * some other record is left out, so a commit that also updates a parent does
 * not paint the parent's field onto this form. `recordId` null is a create, or
 * the story itself: only a problem that names no record.
 */
export function fieldProblems(
  problems: readonly Problem[],
  recordId: string | null = null,
): { field: string; message: string }[] {
  const groups = new Map<string, Problem[]>()
  for (const problem of problems) {
    const field = problem.field
    if (!field) continue
    if ((problem.record_id ?? null) !== recordId) continue
    const list = groups.get(field)
    if (list) list.push(problem)
    else groups.set(field, [problem])
  }
  return [...groups.entries()].map(([field, group]) => ({
    field,
    message: group.map(problemMessage).join(' '),
  }))
}

/** The primary text of a conflict row's current fields, when those fields carry one. */
export function conflictRowLabel(row: ConflictRowView): string | null {
  if (row.fields == null || row.kind == null) return null
  return primaryText(row.kind, row.fields)
}

/** A row the response marks gone: it is missing, or it has no current fields. */
export function conflictRowIsGone(row: ConflictRowView): boolean {
  return row.reason === 'missing' || row.fields == null
}

function writeRowId(write: Write): string | null | undefined {
  if (write.op === 'create') return undefined
  if (write.op === 'set_story') return null
  return write.id
}

/**
 * The same writes, with each revision replaced by the current one the conflict
 * reported for that row. A create has no revision. A row that did not move
 * keeps the revision the write already carries.
 */
export function writesWithCurrentRevisions(
  writes: readonly Write[],
  rows: readonly ConflictRowView[],
): Write[] {
  return writes.map((write) => {
    const id = writeRowId(write)
    if (id === undefined) return write
    const row = rows.find((item) => (item.id ?? null) === id)
    if (row?.revision == null) return write
    return { ...write, revision: row.revision }
  })
}

/** The conflict marks the record with this id gone. */
export function recordGone(rows: readonly ConflictRowView[], id: string | null): boolean {
  const row = rows.find((item) => (item.id ?? null) === id)
  return row != null && conflictRowIsGone(row)
}

/** The record a write updates or deletes is gone, so there is nothing to save over. */
export function editedRecordGone(writes: readonly Write[], rows: readonly ConflictRowView[]): boolean {
  return writes.some((write) => {
    const id = writeRowId(write)
    return id !== undefined && recordGone(rows, id)
  })
}
