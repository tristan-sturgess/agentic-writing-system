# DEF-49 — Revise V2 architecture docs into the V3 design and migration model

- URL: https://linear.app/tristansturgess/issue/DEF-49/revise-v2-architecture-docs-into-the-v3-design-and-migration-model
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Use the existing V2 architecture documentation plus the V3 brainstorm to produce the **overall V3 architecture design** before any implementation planning begins.

This issue is documentation/design work only. The objective is to understand the current V2 architecture, capture the lessons learned from it, and revise the docs so they describe the intended V3 system coherently.

## Architecture work

* Review the existing V2 architecture docs and implementation structure as evidence for how V2 actually works.
* Update the architecture to incorporate the V3 workstreams:
  * simplified event graph and signals
  * redesigned plot-planning workflow
  * optional exploration/character reasoning tools
  * eval-first architecture
  * story-bible exploration/retrieval
  * lower-cost/faster execution
  * local-first but deployment-ready storage/orchestration boundaries
* Identify which major V2 concepts/components appear likely to be:
  * **Port**
  * **Adapt**
  * **Rewrite**
  * **Drop**
* Keep that inventory architectural rather than turning it into implementation tickets yet.
* Make dependencies and interfaces between the revised subsystems explicit.

## Deliverables

* Revised V3 architecture docs describing the end-to-end system.
* Major state/data models and agent boundaries documented.
* A V2-to-V3 port/adapt/rewrite/drop inventory.
* A list of unresolved architectural questions that still need decisions.
* Enough architectural specificity that a separate implementation plan can be created afterward.

## Out of scope

* Implementing V3.
* Refactoring the V2 codebase.
* Creating the detailed V3 implementation issue breakdown before the architecture is finished.

## Open questions

* Which existing V2 architecture documents should be treated as canonical inputs?
* How much of the current repo/package structure should influence the V3 architecture versus being treated as an implementation detail?
* Should deployment architecture be fully specified now, or only the abstraction boundaries needed to keep future deployment options open?
