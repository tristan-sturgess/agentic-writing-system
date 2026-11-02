# DEF-53 — Revise the event graph and signal model architecture

- URL: https://linear.app/tristansturgess/issue/DEF-53/revise-the-event-graph-and-signal-model-architecture
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Revise the V2 architecture docs to define a simpler V3 event graph and signal model that supports story planning without requiring the interpretation-heavy V2 workflow.

This issue is architecture/documentation work only. Do not implement a new event schema or migrate existing data here.

## Architecture work

* Document the current V2 event, interpretation, and signal model and the problems encountered with it.
* Define the proposed V3 role of events as small, concrete occurrences describing what happened, when/where, participants, and resulting state/signals.
* Define how signals could generalize beyond characters to locations and world state.
* Decide whether character interpretations remain persisted concepts, become optional/on-demand outputs, or disappear from the core model.
* Define how chronology and any causal relationships should be represented.
* Design the agent-facing representation of an event-graph slice so a planner can understand events and relationships clearly.

## Deliverables

* Revised event/signal architecture docs and conceptual schemas.
* Documented lifecycle for creating, retaining, discovering, and consuming signals.
* Decision or explicit tradeoff analysis for chronology and causal links.
* Defined relationship between events/signals and plot planning.
* Open questions carried into implementation planning.

## Open questions

* Timestamps/order fields, explicit chronology edges, or both?
* Are explicit causal event links necessary?
* If so, which relation types are useful without over-modeling the graph?
* What is the generalized signal schema for characters, locations, and world state?
* Should interpretations remain anywhere in persisted architecture?
* What representation should agents receive for a relevant graph slice?

## Shared physical-state integration

Events/IDs, timeline, characters and locations live in one shared graph/state object. [Story Space & Timeline](https://linear.app/tristansturgess/project/story-space-and-timeline-d288b09de38f) maintains its location/physical-timeline aspects rather than duplicating events or characters.

Align this event model with DEF-78/79/81: authoritative physical facts, event placements, character whereabouts, location state changes and derived query views. Prefer representations that prevent contradictions, with deterministic checks for calculable conflicts and explicit uncertainty where facts are insufficient. Location-agent semantic assessment complements those checks; passing checks does not establish complete consistency.

Both agents share read tools; protected spatial/timeline mutations go through the location agent. Exact event-creation handoff and field authority are defined in [DEF-78](https://linear.app/tristansturgess/issue/DEF-78/define-shared-graph-views-physical-state-ownership-and-agent). This issue remains architecture/documentation work.
