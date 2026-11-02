# DEF-54 — Revise plot-planning architecture around global narrative intent

- URL: https://linear.app/tristansturgess/issue/DEF-54/revise-plot-planning-architecture-around-global-narrative-intent
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Revise the V2 architecture docs to define a V3 plot-planning model that reasons from global narrative intent and produces structured events more directly, rather than depending on a large chain of local character-interpretation steps.

This issue is architecture/documentation work only. Do not build the new planner or conversion workflow here.

## Architecture work

* Document how the current V2 plot-planning workflow works and where simulation-heavy interpretation constrains story planning.
* Define the responsibilities and inputs/outputs of the V3 plot-planner agent.
* Define how the planner should operate on bounded plot sections or event-graph regions.
* Decide the role and format of an intermediate plot plan before conversion into events/signals.
* Define where character/world plausibility constraints enter the workflow and where they should be validated.
* Document how desired future beats can legitimately constrain earlier interpretation/reaction while preserving coherence.
* Identify which parts of the V2 planner architecture should be retained, adapted, or removed.

## Deliverables

* Revised plot-planning architecture docs and end-to-end flow.
* Defined planner boundaries, context inputs, intermediate outputs, and event-conversion responsibilities.
* Decision or tradeoff analysis for plan format and planning-unit size.
* Defined consistency/validation responsibilities.
* Open questions carried into implementation planning.

## Open questions

* Markdown, structured JSON/schema, or hybrid intermediate plan?
* What should the default planning unit be: beat, scene, sequence, act, or graph window?
* Which constraints belong during generation versus post-generation validation?
* How should desired future plot beats be reconciled with character plausibility?
* Should conversion from plan to events be deterministic, LLM-driven, or hybrid?
* Which V2 plot-planning concepts remain worth porting?

## Planner/location-agent interaction over shared state

The narrative planner and location agent use views of the same event/character/location/timeline graph. Both can query deterministic read tools for whereabouts, occupants, routes and state. The planner submits proposed events and place/time constraints; protected spatial/timeline updates go through the location agent's validated mutation tools.

Align with [DEF-78](https://linear.app/tristansturgess/issue/DEF-78/define-shared-graph-views-physical-state-ownership-and-agent) and [DEF-80](https://linear.app/tristansturgess/issue/DEF-80/define-planner-location-agent-negotiation-refinement-and-conflict): iterative proposal → deterministic checks plus agent contextual reasoning → applied update, error, clarification or suggested alternatives → planner revision. Do not assume all conflicts are formalizable. Two conversations in House are not inherently contradictory; a known minimum 30-minute trip in a 10-minute window yields a calculable timing conflict. Automatic room selection or relocation authority is still open.

The [Story Space & Timeline](https://linear.app/tristansturgess/project/story-space-and-timeline-d288b09de38f) project exercises this interaction independently. This issue retains its architecture scope.
