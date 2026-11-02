# DEF-90 — Refine the Story Bible data model

- URL: https://linear.app/tristansturgess/issue/DEF-90/refine-the-story-bible-data-model
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3
- Attached document: [Story Bible Data Model — Draft 2](../story-bible-data-model-draft-2.md)

## Goal

Refine the **V3 Story Bible conceptual data model**: what information is stored, how objects connect, and how state changes over fictional time. The attached *Story Bible Data Model — Draft 2* is a working reference, **not** a finalized architecture or implementation specification.

## Current design direction

* Five core objects: **Entities, Events, Narrative Units, Arcs, and Assertions**.
* **Properties live on Entities** and describe an entity; **Assertions connect Entities** and describe relationships between them. Keep these distinct.
* Properties and Assertions use concise **free-form natural-language statements**, not a fixed predicate vocabulary. Assertions explicitly reference two or more entities for graph linkage.
* Each statement has stable identity and optional validity bounds, event anchors/causes, supersession links, or point-in-time `observed_at` semantics. Histories can be reconstructed as views across records.
* **User control is unrestricted** except for basic structural integrity: the user can directly rewrite or override statements. **Agent safeguards** discourage ambiguity, duplication, overly broad claims, and semantic drift. Agents represent in-world meaning changes with new records and temporal transitions instead of silently rewriting statements.
* Do not introduce Assertions between Properties or automated dependency propagation in the initial model.

## Refinement work

* Clarify object boundaries, entity linkage, property/assertion semantics, and graph representation.
* Refine temporal applicability, observations, Event links, supersession, and unresolved persistence/overlap questions.
* Examine subjective beliefs, uncertain facts, establishment status, and contradiction detection without overconstraining the user's manual editing.
* Reconcile the conceptual model with the other V3 architecture workstreams where needed.
* Update the reference document as decisions evolve and record unresolved tradeoffs.

## Scope

**Architecture and data modeling only.** Do not implement schemas, migrations, storage, or agent workflows here.

## Working reference

Attached Linear document: **Story Bible Data Model — Draft 2**.
