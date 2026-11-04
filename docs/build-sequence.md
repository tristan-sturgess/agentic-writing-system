# Build sequence

This is the implementation order from the 2026-11-02 briefing. Each slice should be usable on its own. Later slices add workflows on top of the same Story Bible. They do not replace it.

The Linear project asked for a finished architecture before any implementation plan. These docs are the review gate for that architecture in the form we are actually going to build. After review, slice 1 can start. Open questions that do not block a slice stay in [open-questions.md](open-questions.md).

## Slice 0 — Documents

This folder. Capture version 2, the Linear concept, and the working direction, then stop for review.

## Slice 1 — Story Bible data model

Implement the conceptual model in [story-bible.md](story-bible.md) as a real schema, with persistence that can run locally.

Include the ownership boundary from [deployment-and-concurrency.md](deployment-and-concurrency.md): a story belongs to an owner, writes are transactional, and concurrent updates have an explicit rule. Do this in the schema even while there is only one local user.

Leave prose fields present only as a place narrative units can point at later. Do not build the prose workflow.

## Slice 2 — User editing and visualization

A small set of views and editors on the model from slice 1:

- Create and edit entities, properties, and assertions.
- Create and edit events and arcs, and see how arcs group events.
- See the story at a useful level: who exists, how they relate, and what the arcs are doing.

"A little" is the bar. The views have to make the model inspectable and hand-editable. They do not have to cover every future workflow. The UI technology is still open; slice 2 is the point where that choice gets made, because the visualizations are the reason to leave NiceGUI. See [open-questions.md](open-questions.md).

## Slice 3 — Arc-planning agent

A chat interface and tools aimed at one job: take the user's description and write story arcs into the Story Bible.

The agent may create and revise the entities, properties, assertions, events, and arcs that the arcs depend on. The user can interrupt, edit by hand, and send another prompt. The agent reads and writes the same model the user edits.

This slice does not write prose. Character-interview tools and multi-candidate plot exploration, from Linear DEF-55, are optional later additions to this agent. They are not required to prove the first loop.

## Slice 4 — Evaluations for arcs and other generated structure

Add evaluations before changing the arc workflow further. The first evals cover:

- Story arcs, as the primary target.
- Characters and other generated entities.
- The Story Bible as a whole, at a coarse level.

Each run records the prompt, the workflow version, the model, the inputs, the resulting bible, and the scores, so a later change can be compared. Cost and latency are recorded on the same run. Details are in [architecture/evaluations.md](architecture/evaluations.md).

Prose evals wait for slice 5.

## Slice 5 — Prose workflow and prose evaluations

Add the workflow that writes prose from the bible, then add evaluations for that prose. Version 2's scene-writing pipeline is reference material for this slice, not a starting point for slices 1–4. See [v2-import-inventory.md](v2-import-inventory.md).

## Explicitly later

- Hosted multi-user deployment on Railway. The local app is the first runtime. The storage boundary from slice 1 is what makes the move possible.
- Durable orchestration for workflows that run many minutes. The arc agent can start in-process. Long-running durability is designed when a workflow actually needs to survive a restart. Linear DEF-51 stays the question list.
- The Story Space & Timeline location agent, routes, and physical-time checks.
- Optional plot exploration, character-query interviews, and richer context-assembly research agents.

## What "done" means for the early slices

Slice 1 is done when a story can be saved and loaded, the core objects exist, user-level integrity rules hold, and two concurrent writes have a defined outcome.

Slice 2 is done when a person can build a small bible by hand and see the arcs and entities without reading raw storage.

Slice 3 is done when a prompt can produce arcs in that same bible, and the user can revise the result by hand or with another prompt.

Slice 4 is done when two versions of the arc workflow can be run on the same fixture and compared.
