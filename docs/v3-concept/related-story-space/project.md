# Story Space & Timeline

Snapshot of Linear project `P-DEF-10`, retrieved 2026-11-02. This is a separate project from Creative Writing System V3. DEF-53, DEF-54, and DEF-56 point at it.

- URL: https://linear.app/tristansturgess/project/story-space-and-timeline-d288b09de38f
- Status at snapshot: Backlog
- Summary: Explore location and physical-timeline consistency over shared story state, with shared read tools, location-agent writes, deterministic checks and agent reasoning.
- Documents: [concept.md](concept.md), [requirements.md](requirements.md)

## Purpose

Build the location and physical-timeline subsystem independently so its model, visualizations, and agent interface can be exercised and refined before integration with the creative writing system.

Events, timeline, characters and locations exist in one shared graph/state object. This subsystem maintains, interprets, queries and renders its location and physical-timeline aspects through a Pointcrawl-inspired graph, free-form containment, temporal state and lightweight whereabouts.

Both narrative and location agents use shared deterministic read tools. The narrative agent proposes events and spatial/time constraints; the location agent assesses them and applies protected physical updates through validated mutation tools. Deterministic invariants/checks prevent or detect calculable contradictions; agent reasoning handles contextual ambiguity and semantic concerns, with errors, clarification requests or alternatives enabling iterative negotiation.

## Deliverables

* Concept document defining responsibilities and integration with the creative writing system.
* Requirements document covering the local UI, temporal model, routing, character whereabouts, progressive specificity, and documented local REST API.
* Decision issues for unresolved semantics and scope.
* A standalone local app and agent workflow that can be tried with representative story scenarios; implementation planning follows the initial decisions.

## Principles

Progressive specificity; preserve established facts; distinguish unknown from impossible; keep containment separate from travel; share one underlying model between UI and API; keep character tracking limited to physical whereabouts.

## Scope boundary

Maintain locations, physical connections, location state, event placement and character whereabouts over story time within the shared graph. Shared entity identity is settled; exact field permissions, automatic-refinement authority and UI write policy remain design questions. Rich character psychology, knowledge/beliefs, plot planning, prose generation, full-world simulation, and multi-user deployment are outside this project's initial scope.

## Decision issues

These were not copied in full. They remain the live Linear issues:

| ID | Title |
| --- | --- |
| [DEF-78](https://linear.app/tristansturgess/issue/DEF-78/define-shared-graph-views-physical-state-ownership-and-agent) | Shared-graph views, physical-state ownership and agent permissions |
| [DEF-79](https://linear.app/tristansturgess/issue/DEF-79/define-story-time-temporal-state-and-deterministic-route-semantics) | Story-time, temporal state and deterministic routing |
| [DEF-80](https://linear.app/tristansturgess/issue/DEF-80/define-planner-location-agent-negotiation-refinement-and-conflict) | Planner–location-agent negotiation, refinement and conflict responses |
| [DEF-81](https://linear.app/tristansturgess/issue/DEF-81/resolve-location-hierarchy-spatial-relations-and-character-whereabouts) | Hierarchy, spatial relations and character whereabouts |
| [DEF-82](https://linear.app/tristansturgess/issue/DEF-82/choose-the-first-prototype-scope-and-apivisualization-feedback) | First prototype scope and API/visualization feedback |
