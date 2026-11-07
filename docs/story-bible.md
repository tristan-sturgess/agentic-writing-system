# Story Bible

This is the conceptual model slice 1 implements. It says what a story stores, how the records point at each other, and how a writer's edit differs from an agent's. Storage, ownership, and concurrent writes are in the persistence doc. How an agent is allowed to call tools is in the agents doc.

The bible is a partial account of a fictional world and of the narrative told about it. Missing information is unspecified. It is a record the writer and the agents can both read and change. It is not a simulation that has to explain every change with an effect.

## The story

Every record below belongs to one story.

The story has its own id, assigned by the store. That id may be opaque. Who owns the story is specified in the persistence doc.

The story also stores the writer's framing of the piece, and the reading order of the top-level Narrative Units:

| Field | Role |
| --- | --- |
| `title` | The name of the work. |
| `description` | A short account of the project. |
| `premise` | What the story is about. |
| `tone` | The intended feeling. |
| `themes` | The ideas the story is turning over. |
| `writing_style` | How the prose should sound, once prose exists. |
| `unit_ids` | The top-level Narrative Units in reading order. An act has no parent unit, so the story holds that order. |

Version 2 kept premise, tone, themes, and writing style as a separate narrative-style object. They are about the work, so they live on the story. They are not Entities, and they have no validity interval. The writer and an agent can both edit them.

## Records

Five kinds of record live inside the story. Properties are a sixth kind, owned by an Entity. They are not Assertions.

Ids inside the story are readable and stable. The rules are in [Identity](#identity). The field lists here are the schema. An implementation may add bookkeeping such as created-at timestamps. It may not add a second store of "current state" that can drift from these records.

### Entity

A persistent thing in the fictional world: a character, a place, an object, an organization, a concept. A city, a building, and a room are separate Entities when the story needs them at those scales. There is one Entity record, not a subtype per kind of thing.

| Field | Required | Role |
| --- | --- | --- |
| `id` | yes | Stable id. |
| `name` | yes | Display name. Renaming does not change `id`. |
| `notes` | no | Free text. Notes can stay prose. They do not have to be split into Properties. |

An Entity owns its Properties. Deleting the Entity deletes those Properties.

### Property

A short free-form statement about one Entity. "Mara is generally distrustful of strangers." "Mara has blue eyes." "The room smells of cedar."

The statement is natural language. It does not use a fixed vocabulary or a subject-predicate-object grammar.

| Field | Required | Role |
| --- | --- | --- |
| `id` | yes | Stable id. |
| `entity_id` | yes | The owning Entity. |
| `statement` | yes | The claim. |
| `when` | no | When the claim is known to hold. A list of spans. Empty means no time was recorded. |
| `caused_by` | no | The Event that brought the claim about, if there is one. |
| `supersedes` | no | The earlier Property this one replaces. Same Entity. |

### Assertion

A short free-form statement about a relationship. The relationship can be among Entities, Events, and Arcs. "Mara distrusts John." "The bedroom connects to the hallway." "The letter follows the arrival, and it is what changes Mara's mind." "Mara's leaving is her journey from distrust toward trust."

The sentence carries the meaning. It does not need a predicate slug, and it does not have to start with one participant and end with another. The id lists are what make the participants explicit. An Assertion does not connect Properties or other Assertions. Slice 1 does not propagate a change from one statement to another, and it does not read an Assertion as a sort key for story time. Story time comes from the spans on an Event.

| Field | Required | Role |
| --- | --- | --- |
| `id` | yes | Stable id. |
| `entity_ids` | no | Entities in the relationship. |
| `event_ids` | no | Events in the relationship. |
| `arc_ids` | no | Arcs in the relationship. |
| `statement` | yes | The claim. One independently meaningful relationship. |
| `when` | no | When the claim is known to hold. The same span list as on a Property. |
| `caused_by` | no | Same as on a Property. |
| `supersedes` | no | The earlier Assertion this one replaces. |

`entity_ids`, `event_ids`, and `arc_ids` together name at least two records. A causal claim between two Events is an Assertion with those Events in `event_ids`. Version 2 stored that kind of claim as a typed edge (`follows`, `directly_follows`, `depends_on`, `during`). There is no edge record here. An Assertion that names an Arc is how the story says what that Arc is about.

A character's belief, if the story needs one stored, is a Property of that character, or an Assertion when the belief is about a relationship. It uses the same fields as any other statement. There is no rank, score, or derived strength.

### Event

Something that happens in the fictional world, at whatever scale the story needs. An Event can involve Entities. It can be the moment a Property or Assertion starts or stops being valid. It does not have to record every off-page occurrence, and it does not have to explain every change of state. A relationship between Events is an Assertion.

| Field | Required | Role |
| --- | --- | --- |
| `id` | yes | Stable id. |
| `title` | yes | Short name. |
| `description` | no | What happens. |
| `entity_ids` | no | Entities that take part, including places. |
| `when` | no | When the Event occurs. The same span list as on a Property. Empty means its time is unspecified. |

### Narrative Unit

A unit of presentation, such as an act, a chapter, or a scene. Reading order is the order of these units. That order is independent of when the Events happen in the world.

The structure is a tree, read from the top. The story's `unit_ids` lists the acts in order. An act's `child_ids` lists its chapters in order. A chapter's `child_ids` lists its scenes in order. A writer can start with an act and break it downward. A unit with no children is a leaf, such as a scene that gets prose.

| Field | Required | Role |
| --- | --- | --- |
| `id` | yes | Stable id. |
| `title` | yes | Short name. |
| `summary` | no | What this unit presents. |
| `notes` | no | Planning notes. |
| `child_ids` | no | The Narrative Units inside this one, in reading order. |
| `subject_ids` | no | What this unit depicts. A set of Entity, Event, and Arc ids. |
| `prose` | no | The text, when the prose slice exists. Empty until then. |

`subject_ids` is unordered. Duplicates are refused. A scene that presents what happens usually names Events, Arcs, or both. A unit that only describes a character names that Entity and may name nothing else. An act whose chapters do the depicting may leave the set empty. The same Event, Arc, or Entity may appear in more than one unit. Order inside the set is not story time and not reading order.

`child_ids` is the reading order of the units it contains. A Narrative Unit appears in exactly one list: the story's `unit_ids`, or one unit's `child_ids`. A list cannot contain the same id twice. A unit cannot contain itself, directly or further down the tree. A save that would break either rule is refused.

Version 2 stored a scene blueprint (purpose, point of view, stakes, stance, outline) beside the prose, and stored each scene's position as a number. Those generation artifacts are part of the prose workflow. They are not fields on the Narrative Unit in this model. Slice 1 does not enforce "one unit per event."

### Arc

A narrative thread defined by the Events that belong to it. A plot, a subplot, a character's journey, and a relationship can all be Arcs. Several Arcs may include the same Event.

| Field | Required | Role |
| --- | --- | --- |
| `id` | yes | Stable id. |
| `title` | yes | Short name. |
| `description` | no | What the thread does and what it is about, in prose. |
| `event_ids` | no | The Events that make up the thread. List order is the thread's own order, which may differ from story time. |

The description can say who the thread follows and what changes. That prose is not a list of subjects. A character, a place, a relationship, or another Arc is tied to this one by an Assertion that names it. A character Arc will involve many other people through its Events. Those participants stay on the Events. The Assertion names only the link the story is actually claiming, such as "this Arc is Mara's journey" or "this Arc is Mara and John's relationship." An overarching plot may have no such Assertion.

## How the records connect

- An Entity owns its Properties.
- An Assertion names the Entities, Events, and Arcs in the relationship.
- An Event names the Entities involved.
- A span may name an Event as a time point, and a Property or Assertion may name an Event as `caused_by`. That reference keeps working if the Event's spans change.
- A Narrative Unit lists the units inside it, in reading order, and names the Entities, Events, and Arcs it depicts. The story lists the top-level units in reading order.
- An Arc names the Events that define it. Who or what it is about is an Assertion.

## When

A Property, an Assertion, and an Event each store story time in one field, `when`. The value is a list of spans. The list can be empty. Later kinds of span can be added to this list without adding a field to the records. `caused_by` and `supersedes` stay on the statement. They say why a claim changed, not when it holds.

A **time point** is an object with one of these shapes:

- `{ timestamp }`, a story-time timestamp: an ISO 8601 date (`YYYY-MM-DD`) or date-time (`YYYY-MM-DDTHH:MM` or `YYYY-MM-DDTHH:MM:SS`)
- `{ event_id }`, an Event id

The object wraps the value so that a new kind of time point can be added later without changing the records that hold one.

A timestamp is story-local time in the proleptic Gregorian calendar, with no time zone. Years run from `0001` to `9999`, the range common date libraries accept. Two timestamps compare chronologically, and a date-only value is the start of that day. The calendar is nominal: a world with no Gregorian calendar still uses these values, and the writer reads year 1000 as whatever the story calls it. Months and days are then ordinals, nothing more. A story that needs its own calendar, with its own names, month lengths, or a year outside that range, would add a new kind of time point to this list, beside the timestamp and the Event id. It would not add a field to any record.

A **span** is one of these kinds:

| Kind | Fields | What it records |
| --- | --- | --- |
| `at` | `at`, a time point | Known at that point. It says nothing about any other point, including the stretch between two `at` spans. |
| `range` | `start` and `end`, each an optional time point | Known across that period. Either bound may be absent. |

On a Property or an Assertion, the list says when the claim is known to hold. Each `range` is its own period of validity, and the gaps between ranges stay empty. Each `at` is an observation at that point. Several observations do not make the claim valid between them, and they do not make it an ongoing fact. An empty list means no time was recorded. A standing claim, such as a description that the story treats as given, uses an empty list.

On an Event, the same list says when the occurrence happens. One `at` is an instantaneous Event. Several `at` spans mean it was occurring at those points, not that it continued between them. A `range` is a period with a start, an end, or both. A missing bound means that bound is unknown. It does not mean the Event is still happening, and it does not mean the Event covers the whole timeline. An empty list means the Event's time is unspecified. A momentary Event ordinarily has one `at`. The field is still a list, so a repeated or stretched occurrence uses the same field.

A span on an Event cannot use that same Event as a time point. Following Event ids through spans cannot come back to an Event already on the chain. A save that would make such a cycle is refused.

### What is in force

This reading is for Properties and Assertions. Slice 1 uses it. A stricter overlap rule can replace the view later. It must not add a new record type or a new field beside `when`. That replacement is still open. See [open-questions.md](open-questions.md).

- A statement whose `when` is empty is included at every query point.
- A statement is in force at a query point when any `range` covers that point: the point is at or after `start` (or `start` is absent) and before `end` (or `end` is absent). An absent `end` on a statement means the claim still applies after it starts. Ranges do not fill the gaps between them.
- An `at` span records an observation at that point. It does not put the statement in force at that point or at any other point.
- Spans on the same statement are stored as written. Slice 1 does not merge them, and an `at` that falls outside a `range` is allowed.
- A time point that is a timestamp compares as that value. A time point that is an Event resolves to a timestamp only along a chain of Events that each have a single span yielding one timestamp: an `at` whose point is a timestamp, or the bound in use when that bound is a timestamp. Several spans, a cycle, or a bound that does not resolve leave the comparison unresolved. The view still includes the statement and marks the comparison unresolved.
- An Assertion that names Events is a claim about them. It is not a substitute for their spans.
- Two statements may contradict. Slice 1 saves both. Nothing in the model detects a contradiction between two sentences, and nothing blocks the writer or the agent over one.

A Property or Assertion means what its `statement` says. The sentence does not change meaning as story time moves. An in-world change is a new record. The older record keeps its sentence. Its spans can be adjusted, and the new record can `supersede` it. `caused_by` is optional. No Event is required for every new statement.

`supersedes` is meant to imply an end: the superseded statement stops holding when the new one starts. Slice 1 does not derive that end or check for it. The in-force view reads the spans as written, so an agent that supersedes a statement also closes the old one's open `range` at the point the new one starts, as the agents doc requires. A writer who leaves the old range open sees both statements in force, which is allowed. A later view may read the end from `supersedes` when the old record's spans do not give one. That is a change to the view, not to the records.

Histories are views over these records. They are not a second object. The persistence doc keeps a separate history of edits, which commit changed which record. That is bookkeeping about the records, not story time, and it is not a second copy of the current state.

```yaml
events:
  - id: event_arrival
    title: Arrival
    when:
      - kind: at
        at: { timestamp: t1 }
  - id: event_the_market
    title: The market
    when:
      - kind: at
        at: { timestamp: t2 }
  - id: event_the_letter
    title: The letter
    when:
      - kind: range
        start: { event_id: event_arrival }
        end: { timestamp: t3 }

entities:
  - id: entity_mara
    name: Mara
    properties:
      - id: prop_mara_distrustful
        statement: Mara is generally distrustful of strangers.
        when:
          - kind: range
            start: { event_id: event_arrival }
            end: { event_id: event_the_letter }
      - id: prop_mara_cautious
        statement: Mara is cautiously willing to trust strangers.
        when:
          - kind: range
            start: { event_id: event_the_letter }
        caused_by: event_the_letter
        supersedes: prop_mara_distrustful

arcs:
  - id: arc_mara_leaves
    title: Mara leaves
    description: Mara arrives unwilling to trust strangers. The letter is what changes that.
    event_ids: [event_arrival, event_the_market, event_the_letter]

assertions:
  - id: assertion_mara_john
    entity_ids: [entity_mara, entity_john]
    statement: Mara distrusts John.
    when:
      - kind: at
        at: { event_id: event_the_market }
      - kind: at
        at: { timestamp: t4 }
  - id: assertion_letter_follows_arrival
    event_ids: [event_arrival, event_the_letter]
    statement: The letter follows the arrival, and it is what changes Mara's mind.
  - id: assertion_mara_leaves_is_maras
    entity_ids: [entity_mara]
    arc_ids: [arc_mara_leaves]
    statement: Mara's leaving is her journey from distrust toward trust.
```

The ids in the example follow the identity rules below. `t1` and the other timestamp labels stand for ISO 8601 story-time values in order, such as `1847-03-02`. The time points are the objects defined above. The example is the shape of the data, not a storage format.

## The writer and the agent

Both write the same records.

The writer can create, view, reword, and delete, including wording that is unconventional or poorly formed. A save may refuse a broken reference, an empty required field, or a length cap the implementation has set. It may not refuse a save because the sentence is redundant, broad, or badly written.

An agent-written Property or Assertion should be concise, narrow, and clear. When the world changes, the agent leaves the old sentence in place, adjusts its spans, and creates a new record. The agent does not rewrite the old sentence so that it means something else. A writer's rewrite is a correction of the record. It does not need an Event or a `supersedes` link.

## Identity

Record ids inside a story are readable slugs, minted once and then frozen. Renaming a record does not change its id. Anything that pointed at it keeps pointing at it. An import, and a revert that restores a deleted record, keep the id the record already had; they do not mint a new one.

Mint an id only when the primary text is non-empty. The primary text is the Entity `name`, the Property or Assertion `statement`, or the Event, Narrative Unit, or Arc `title`. A blank create does not mint a placeholder such as `char` or `event`. The screen collects the name or title before the record exists.

The id is a prefix plus a slug of that text:

| Record | Prefix |
| --- | --- |
| Entity | `entity_` |
| Property | `prop_` |
| Assertion | `assertion_` |
| Event | `event_` |
| Narrative Unit | `unit_` |
| Arc | `arc_` |

The slug is lowercase words from the primary text, separated by underscores, capped at the first eight words. An Event titled "The Letter" mints `event_the_letter`. A Property whose statement is "Mara is generally distrustful of strangers, especially men from the capital" mints `prop_mara_is_generally_distrustful_of_strangers_especially_men`. A collision appends `_2`, `_3`, and so on.

A slug minted from a statement can read differently from the sentence after a rewrite. That is acceptable. An agent does not reword a stored statement; it creates a new one and supersedes the old. Only the writer edits a sentence in place, so a Property or Assertion slug goes stale only when the writer chose to change the sentence, and the id's job is to stay stable through that, not to describe it.

Version 2 froze slugs the same way, then minted `char` and `char_2` when the screen created a character before anyone typed a name. Those generic ids are the case this rule avoids.

## References

Every id field names a record in the same story.

- A save that introduces an unknown id is refused. The refusal includes the ids that do exist for that kind of record, so an agent can correct itself.
- An Assertion names at least two records, and each of them is an Entity, an Event, or an Arc.
- A Narrative Unit appears in exactly one of the story's `unit_ids` or some unit's `child_ids`. Neither list contains a duplicate. No unit contains itself through `child_ids`.
- A record cannot `supersede` itself.
- Deleting an Entity deletes the Properties it owns.
- Deleting any record that something else still names is refused. The refusal lists the referring records. The writer or the agent edits or deletes those first. List fields count: an Assertion's `entity_ids`, `event_ids`, and `arc_ids`, an Arc's `event_ids`, an Event's `entity_ids`, a Narrative Unit's `child_ids` and `subject_ids`, the story's `unit_ids`, and any Event id used as a time point.
- Version 2 warned about dangling effect targets and saved anyway. Replay then skipped them. This model has no effect list to skip. A dangling id is refused for the writer and for the agent.

## What the early slices show

The records have to be editable as structured fields: Entities and their notes and Properties, Assertions, Events, Narrative Units, Arcs, and the story framing fields. Derived "in force" text is a view. The view is read-only.

Two pictures are part of the model, whatever widget draws them:

- Events arranged in story time from the spans in `when`. A `range` is a stretch between the bounds that resolve. Each `at` is its own point, with nothing drawn between separate points. An Event whose spans do not resolve to a timestamp is shown without a derived order. Selecting an Event opens it for editing. A relationship between Events is an Assertion, edited with the other Assertions.
- Arcs laid over those Events, so a thread shows the Events that belong to it.

Version 2 drew a graph of typed edges between Events and offered connect actions for those edges. This model arranges Events from their spans and shows Arcs over them. The widget stays open. See [open-questions.md](open-questions.md).

## Locations

A place is an Entity. An Event can name it. Routes, travel times, character whereabouts, and a scrubber for moving through a place belong to the Story Space & Timeline project. They are not records in this model. Which fields that project would own, if it is brought in later, stays open.

## Where version 2's mechanisms went

Version 2 stored characters, world facts, and world-state entries as different types, and derived the state at a timeline position by replaying effects and intimacy signals over baselines. Chronology was four edge types between Events. Scenes were the prose unit and pointed at the Events they enacted.

This model keeps stable ids, Events as things that happen, and a split between world time and the order the story is told. State at a time is the in-force view over Properties and Assertions. Relationships, including a cause or an order between Events, are Assertions. Story time is the span list on an Event. Threads are Arcs. Presentation is a Narrative Unit. There is no replay, no signal record, no derived rank, and no edge record between Events.

Version 2's character identity fields (traits, appearance, background, voice), its world-fact tags, and its world-state kinds (pressure, thread, consequence) are not fields here. The same content is written as Properties and Assertions, which cover those cases without a fixed field set.

## Open modeling questions

These stay open on purpose. [open-questions.md](open-questions.md) is the list.

- Whether a stricter overlap rule replaces the in-force view above.
- Whether statements gain a marker for objective fact, belief, or plan. Slice 1 has no such marker. Adding one later must not block a writer's edit.
- Whether an Assertion's references need roles.
- Whether Properties should ever link to other Properties, or whether a change should propagate on its own. Slice 1 does neither.
- Whether a story-specific calendar is ever added as a new kind of time point. Slice 1 uses the ISO 8601 timestamp above.
