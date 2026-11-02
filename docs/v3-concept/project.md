# Creative Writing System V3

Snapshot of Linear project `P-DEF-6`, retrieved 2026-11-02.

- URL: https://linear.app/tristansturgess/project/creative-writing-system-v3-f6bf311c12a2
- Status at snapshot: Backlog
- Summary: Revise the V2 architecture into a coherent V3 design, then use those docs to derive a separate implementation plan.
- Linked resources: the version 2 GitHub repository and its `docs/` tree (older `RevDrSquash/creative-writing-assistant` URLs).

# Goal

Systematically revise the **Creative Writing System V2 architecture documentation** into a coherent V3 architecture.

This project is **architecture and design work only**. It is not the implementation project for V3. The output should be a revised set of architecture docs that capture the lessons from V2, resolve or explicitly document the major design decisions raised in the V3 brainstorm, and make clear what concepts should be retained, simplified, replaced, or deferred.

Once the V3 architecture docs are complete, they will be used to create a **separate implementation plan** for building V3.

# Architectural direction to investigate and document

The main proposed shift is to optimize for **story planning rather than simulation**: keep a lightweight event graph and signal model, but reconsider the expensive character-interpretation chains used to determine plot transitions. The revised architecture should explore giving the plot-planning agent more direct control over narrative structure and using focused tools or subagents only when deeper character/world reasoning is actually needed.

The architecture should also consider how V3 can be **eval-forward, cheaper, faster, and eventually deployable for multiple users**, while preserving a simple local-first development path where appropriate.

These are design directions to work through in the docs, not implementation commitments.

# Principles

* **Architecture first.** Revise the V2 docs before creating implementation tasks.
* **Document decisions, not code changes.** Each workstream should analyze the V2 approach, evaluate the proposed V3 direction, resolve open questions where possible, and update the relevant architecture documentation.
* **Preserve what works.** Identify V2 concepts and components that still fit rather than assuming everything must be rewritten.
* **Make tradeoffs explicit.** Where a question cannot yet be resolved, document the options, constraints, and what would need to be learned before choosing.
* **Keep implementation planning downstream.** Only after the architecture is coherent should we derive a port/adapt/rewrite/drop inventory and implementation sequence.

# Major architecture workstreams

1. Revise the overall V2 architecture/docs into the V3 design and migration model.
2. Define the intended local-first vs deployment-ready service, storage, and multi-tenancy architecture.
3. Decide how long-running agent workflow durability/orchestration should work architecturally.
4. Define the V3 eval architecture and how evaluation fits into development and administration.
5. Redesign the event graph and signal model on paper.
6. Redesign plot planning around global narrative intent and direct event generation.
7. Define optional plot-exploration and character-query capabilities and how they fit into the planning architecture.
8. Define a story-bible exploration/context-assembly architecture.
9. Define cost/latency goals and the observability/instrumentation architecture needed to measure them.

# Project deliverables

* Revised V3 architecture documentation covering the major workstreams above.
* Explicit decisions and remaining open questions for each subsystem.
* A clear description of how the revised subsystems interact end to end.
* A V2-to-V3 migration inventory identifying what should be **port**, **adapt**, **rewrite**, or **drop**.
* Enough architectural specificity to create a separate, concrete V3 implementation plan afterward.

# Out of scope

* Implementing the V3 application or agent workflows.
* Building Postgres/S3 integrations, durable workflow infrastructure, eval tooling, new event schemas, or new agents as part of these issues.
* Creating detailed implementation tickets before the architecture work is complete, except where useful as notes for the eventual implementation-planning phase.

# Issues

| ID | Title |
| --- | --- |
| [DEF-49](issues/DEF-49.md) | Revise V2 architecture docs into the V3 design and migration model |
| [DEF-50](issues/DEF-50.md) | Revise architecture for local-first, deployment-ready storage and multi-tenancy |
| [DEF-51](issues/DEF-51.md) | Revise architecture for durable long-running agent workflow orchestration |
| [DEF-52](issues/DEF-52.md) | Revise architecture for eval-first story and workflow evaluation |
| [DEF-53](issues/DEF-53.md) | Revise the event graph and signal model architecture |
| [DEF-54](issues/DEF-54.md) | Revise plot-planning architecture around global narrative intent |
| [DEF-55](issues/DEF-55.md) | Revise architecture for optional plot exploration and character-query tools |
| [DEF-56](issues/DEF-56.md) | Revise architecture for story-bible exploration and context assembly |
| [DEF-57](issues/DEF-57.md) | Revise architecture for V3 cost, latency, and LLM usage observability |
| [DEF-90](issues/DEF-90.md) | Refine the Story Bible data model |
