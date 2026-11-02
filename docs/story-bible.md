# Story Bible

The working conceptual model is [Story Bible Data Model — Draft 2](v3-concept/story-bible-data-model-draft-2.md), attached to Linear DEF-90. It describes the information the bible stores. It is not a storage schema and not an agent workflow. Slice 1 turns it into a schema. The open modeling questions in Draft 2 stay open until a slice needs them answered.

## What the bible stores

Five core objects, plus Properties owned by Entities:

| Object | Role |
| --- | --- |
| Entity | A persistent thing in the world: a character, location, object, organization, or concept. Holds notes and Properties. Can be specific at different scales, such as city, building, and room. |
| Property | A short free-form statement about one Entity. Stable id. Optional time bounds, observation, cause, and supersession. |
| Assertion | A short free-form statement about a relationship among two or more Entities, with explicit entity links. Same temporal options as a Property. Assertions connect Entities only. |
| Event | Something that happens. Can involve entities and other events, carry time or order, and act as the moment a statement starts or stops being valid. |
| Narrative Unit | How the story is presented: a scene or chapter. Points at the events and entities it depicts, has its own order distinct from fictional chronology, and can hold or point at prose later. |
| Arc | A narrative thread across events: a plotline, subplot, character arc, or relationship arc. Several arcs can share events. |

Histories are views over these records. A statement does not mutate its meaning as story time moves. An in-world change is a new statement, with the old one's validity ended and an optional `supersedes` link. A point-in-time `observed_at` records that something was true then, without claiming when it started or stopped.

Missing information is unspecified. The bible is partial on purpose. It is not a simulation that must explain every state change with an event.

## User edits and agent edits

The user can create, reword, and delete statements even when the wording is awkward. The only hard stops are structural: references resolve, required links exist, and any length limits we choose to keep. Quality rules do not block the user.

An agent-written statement should be narrow, clear, and checked against related statements. When the fictional world changes, the agent adds a new record and adjusts validity. It does not quietly rewrite the old sentence to mean something else. A user rewrite is a correction of the record. It does not require an event.

## What changes relative to version 2

Version 2's Story Bible is specified in [v2/story_bible_model.md](v2/story_bible_model.md). It is event-sourced. Characters have identity plus a baseline of intimacies. Events carry world-state effects and per-character signals. Replay derives character and world state at any timeline position. Chronology comes from typed edges (`follows`, `directly_follows`, `depends_on`, `during`). Scenes are the prose unit, with blueprints that point at enacted events. Narrative style is four flat fields: premise, tone, themes, writing style.

Draft 2 keeps the idea of stable ids, events as things that happen, and a separation between story time and the order the story is told. It changes the center of the model:

- **Statements replace replay.** Properties and Assertions are the stored facts. State at a time is a view over statements whose validity covers that time. Version 2's replay engine, intimacy ranks, evidence scores, and signal effects are not the version 3 core.
- **Relationships are first-class.** Version 2 noted character relationships as future work. Draft 2 makes them Assertions.
- **Arcs are first-class.** Version 2 deferred arc membership beyond event-order edges. Draft 2 gives arcs their own identity and lets them group events by narrative role. That matches the decision to build and evaluate arcs before prose.
- **Entities are one type, specialized by what they are.** Version 2 split characters, world facts, and world-state entries into different stored types, and treated locations as world facts. Draft 2 uses Entities at varying specificity, with Properties for one-entity claims.
- **Interpretations are not required for plot.** Version 2 signals exist so intimacy state can be derived. Version 3 planning should be able to write events and arcs without that chain. Whether a lighter interpretation or belief record survives is an open question in DEF-53, not a requirement of the first schema.
- **Prose is attached, not central yet.** Narrative Units can reference prose. The prose workflow is slice 5.

Version 2's readable slug ids (`char_the_guard` and similar) are a useful implementation habit. Draft 2's examples use the same kind of stable id. The schema can keep human-readable ids that do not change when a display name changes.

## Modeling questions still open

From Draft 2, still unresolved:

- How overlapping or incomplete time bounds work, and what "still true" means when `valid_until` is absent.
- How contradictions are detected when time or perspective is incomplete.
- How to mark objective facts, character beliefs, and tentative plans without taking edit control away from the user.
- Whether Assertions need roles on their entity references.
- Whether Properties ever relate to other Properties, or whether effects ever propagate automatically. The initial model does neither.

From the surrounding architecture issues, also unresolved, and not required to store the first objects:

- Timestamps versus chronology edges versus both (DEF-53). Version 2 used edges only, with creation order as a tie-break, and that was enough to drive replay and a timeline graph. Draft 2 allows a timestamp or an event as a validity boundary.
- Which event-to-event relation types are worth keeping. Version 2's four kinds are a candidate, not a commitment.
- How location containment, travel, and character whereabouts relate to Entities and Events. That work lives in the Story Space project and is outside slice 1.

## Slice 1 schema bar

The first schema needs:

- The six record kinds above, with stable ids and the links Draft 2 describes.
- Notes on entities, separate from Properties.
- A story container those records belong to, and an owner for that story.
- Integrity checks for dangling references.
- A way to read "what is in force" at an event or time as a view, once the temporal fields exist. The view can be simple while the overlap rules are still open.
- Room for a narrative unit to point at prose text later, without a prose editor.

It does not need intimacy evidence, signal review, derived ranks, or a scene-generation blueprint.
