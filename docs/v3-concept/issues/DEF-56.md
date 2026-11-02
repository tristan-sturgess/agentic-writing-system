# DEF-56 — Revise architecture for story-bible exploration and context assembly

- URL: https://linear.app/tristansturgess/issue/DEF-56/revise-architecture-for-story-bible-exploration-and-context-assembly
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Revise the V2 architecture docs to define a V3 story-bible exploration/context-assembly layer that can provide focused context to planning and generation workflows without requiring expensive downstream models to browse the full story bible themselves.

This issue is architecture/documentation work only. Do not build the retrieval/subagent implementation here.

## Architecture work

* Document how V2 currently supplies story-bible context and where unnecessary context size/tool round trips occur.
* Define the responsibilities and inputs/outputs of a story-bible exploration/context-assembly component.
* Evaluate retrieval/search-driven, agentic, and hybrid approaches.
* Define possible output forms: raw chunks, summaries, simplified character/entity blocks, or combinations of these.
* Define provenance requirements so downstream agents can distinguish sourced facts from synthesized context.
* Define how relevance should be determined for a particular plot section or generation task.
* Document how this component should interact with the plot planner and other agents.

## Deliverables

* Revised context-management/story-bible architecture docs.
* Defined component boundaries, request/response semantics, and provenance requirements.
* Decision or explicit tradeoff analysis for retrieval versus agentic exploration.
* Proposed strategy for reducing context while protecting subtle important details.
* Open questions carried into implementation planning.

## Open questions

* Retrieval/search-driven, agentic exploration, or hybrid?
* What model tier should eventually perform story-bible research/summarization?
* Raw chunks, summaries, structured entity blocks, or all three?
* How should relevance be determined for a plot section?
* How should compression avoid losing subtle but important information?
* Does the underlying story-bible architecture itself need further simplification or restructuring?

## Shared physical-context queries

Align context assembly with the [Story Space & Timeline](https://linear.app/tristansturgess/project/story-space-and-timeline-d288b09de38f) shared-graph model. Narrative and location agents can use the same deterministic read tools for character whereabouts, other occupants, temporal location descriptions, routes and physical context, with stable shared IDs.

Distinguish graph-sourced/computed facts, missing information and location-agent contextual assessments in returned context. Preserve coarse placements rather than inventing room assignments. Read/context tools do not silently mutate state; protected physical updates are requested through the location agent. See [DEF-78](https://linear.app/tristansturgess/issue/DEF-78/define-shared-graph-views-physical-state-ownership-and-agent) and [DEF-80](https://linear.app/tristansturgess/issue/DEF-80/define-planner-location-agent-negotiation-refinement-and-conflict). This issue retains its architecture scope.
