# Story Bible Data Model — Draft 2

Snapshot of the Linear document attached to [DEF-90](issues/DEF-90.md), retrieved 2026-11-02.

- URL: https://linear.app/tristansturgess/document/story-bible-data-model-draft-2-6c74b063d225
- Document id: `ae7b89a1-eb14-444e-877e-e9da1116dd2b`
- Updated in Linear: 2026-11-02

---

# Story Bible Data Model

> **Draft 2 — conceptual model, subject to refinement.** This describes the information stored by the Story Bible, not implementation details or agent workflows.

## Overview

The Story Bible is a partially specified representation of a fictional world and its narrative. It supports planning and writing stories, and lets the user inspect and directly control the underlying story information.

The five core object types are **Entities, Events, Narrative Units, Arcs, and Assertions**. **Properties** are a separate kind of record *owned by an Entity*; they are not Assertions.

## Core Objects

### 1. Entity

Anything with a persistent identity in the fictional world.

* Examples: characters, locations, objects, organizations, concepts.
* Has descriptive notes and its own **Properties**.
* Can participate in Assertions and Events.
* Can be represented at different levels of specificity (e.g. city → building → room).

#### Properties (on Entities)

A Property is a concise, free-form natural-language statement **about one Entity** rather than a relationship between entities.

* Examples: "Mara is generally distrustful of strangers"; "Mara has blue eyes"; "The room smells of cedar."
* Has its own stable identity and optional temporal validity, observation, and event links.
* Does **not** require a controlled vocabulary, rigid predicate, or subject–predicate–object grammar.
* Can coexist with descriptive notes, which need not be broken into structured records.
* Properties are distinct from Assertions, even when they address related subjects.

### 2. Event

Something that happens in the fictional world.

* Can involve entities, locations, and other events.
* May have a time, duration, or relative temporal ordering.
* May cause Properties or Assertions to begin or cease being valid.
* Does not need to record every off-page occurrence or explain every state change.

### 3. Narrative Unit

A unit of narrative presentation, such as a scene or chapter.

* References the events, entities, and locations it depicts.
* Can contain or reference prose.
* Has a narrative position distinct from fictional chronological order.
* May be nested in larger narrative units.

### 4. Arc

A narrative thread or development spanning multiple events.

* Examples: plotlines, subplots, character arcs, relationship arcs.
* Groups or connects events according to their narrative roles.
* May track an entity or relationship's development.
* Multiple arcs may reference the same events.

### 5. Assertion

A concise, free-form natural-language statement **about a relationship between two or more Entities**.

* Examples: "Mara distrusts John"; "Alice dislikes the flowers that John grows"; "The bedroom connects to the hallway."
* Contains explicit entity references for graph linkage, but the sentence need not start with one endpoint or end with another.
* Its statement conveys the meaning; it does not require a standardized predicate slug.
* Has its own stable identity and optional temporal validity, observation, and event links.
* In this draft, Assertions connect **Entities only**, not Properties or other Assertions.

A relationship statement may include necessary qualifications or context, but should ordinarily describe one independently meaningful claim.

## Temporal State

**Properties and Assertions are individual statements with temporal applicability.** The statement's semantic content does not itself evolve as story time advances.

Two supported ways of establishing applicability are:

* **Validity interval:** A statement is valid between optional `valid_from` and `valid_until` boundaries. A boundary can reference a timestamp or Event.
* **Point-in-time observation:** `observed_at` establishes that the statement was true at a timestamp or during an Event, without establishing when it became true, stopped being true, or whether it persisted.

Optional `caused_by` links a change to an Event. Optional `supersedes` makes a replacement explicit. When an Event serves as a temporal anchor, the reference remains connected if the Event's position changes.

**Histories are views over individual records**, not separate mutable value lists or an additional authoritative object type. Changing world state can be represented by ending one record's applicability and introducing a different record. No Event is required for every transition.

### Illustrative example

```yaml
entities:
  - id: mara
    properties:
      - id: p1
        statement: "Mara is generally distrustful of strangers."
        valid_from: event_1
        valid_until: event_14
      - id: p2
        statement: "Mara is cautiously willing to trust strangers."
        valid_from: event_14
        caused_by: event_14
        supersedes: p1

assertions:
  - id: a1
    entities: [mara, john]
    statement: "Mara distrusts John."
    observed_at: event_5

  - id: a2
    entities: [alice, john]
    statement: "Alice dislikes the flowers that John grows."
    valid_from: event_8
```

The temporal example is illustrative rather than a final storage schema. In particular, the rules for persistence, overlap, incomplete times, and contradictory statements remain open.

## User Control vs. Agent Safeguards

**User authority:** The user can create, view, directly edit, reword, delete, and otherwise revise Properties, Assertions, and other Story Bible information—even when the resulting wording is unconventional or poorly formed. Only constraints necessary for basic model integrity (and potentially minimal limits such as length) should block user edits. Semantic-quality checks should not prevent user control.

**Agent behavior:** Agent-created Properties and Assertions should be concise, appropriately narrow, clear, nonredundant, and checked against related information for inconsistencies. The agent should **not silently change an existing statement's semantic meaning** to reflect a fictional-world change. Instead, it should preserve the earlier statement, adjust temporal applicability as appropriate, and create a distinct replacement record when needed.

A **user's direct correction or rewrite** is not the same thing as a **change occurring within the fictional world**. The data model supports both; it does not require an Event or supersession record for every direct user edit.

## Relationships Between Objects

* **Entity → Property:** An Entity owns its Properties.
* **Assertion ↔ Entities:** An Assertion references the entities whose relationship it describes.
* **Event ↔ Entities:** Events involve entities, potentially including locations.
* **Event ↔ Property/Assertion:** Events can serve as validity anchors or optional causes.
* **Narrative Unit ↔ Events:** Narrative Units present Events independently of chronological order.
* **Arc ↔ Events/Entities:** Arcs group developments and may focus on particular entities or relationships.

This draft does not model Assertions connecting Properties or automatic propagation of state changes through dependencies.

## Design Principles

1. **Progressive specificity:** Record only the details needed, and refine the world without pretending it is fully specified.
2. **Open-world assumptions:** Missing information is unspecified, not necessarily false.
3. **Properties are not relationships:** Keep single-entity Properties distinct from multi-entity Assertions.
4. **Natural-language expressiveness:** Use short free-form statements, not a fixed predicate ontology.
5. **Stable agent-authored meaning:** Represent in-world semantic changes as new statements with temporal links, rather than silently rewriting old statements.
6. **User control:** The user may directly change semantic content and override agent-oriented quality guidance.
7. **Temporal records as the source of truth:** Events may explain state changes, but an independent event-effect simulation is not required.
8. **World chronology differs from presentation:** Narrative Units can present Events in a different order.
9. **Structured and descriptive knowledge coexist:** Graph-linked records and free-text notes can both live in the Story Bible.

## Open Questions (deferred)

* Persistence and overlap rules for different kinds of statements.
* Contradiction handling when time or perspective is incomplete.
* How objective facts, character beliefs, and tentative plans are distinguished.
* Whether richer entity roles or dependencies are needed within Assertions.
* Whether and how Property-to-Property relationships or automatic effects should be introduced later.

The Story Bible is **not a complete simulation**. It is a flexible, temporally aware collection of entities, their properties, relationships, events, and narrative structure, designed to remain coherent as the story develops.
