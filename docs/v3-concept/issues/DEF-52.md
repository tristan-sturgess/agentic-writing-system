# DEF-52 — Revise architecture for eval-first story and workflow evaluation

- URL: https://linear.app/tristansturgess/issue/DEF-52/revise-architecture-for-eval-first-story-and-workflow-evaluation
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Revise the V2 architecture docs to make evaluation a first-class V3 architectural concern before any eval tooling is implemented.

This issue is architecture/documentation work only. The goal is to define what should be evaluated, where evals fit into the system, what data they require, and how results should be stored/reviewed later.

## Architecture work

* Document the V2 evaluation gap and the V3 goals for repeatable evaluation.
* Define representative end-to-end eval scenarios, such as a short multi-scene story generation.
* Define evaluation boundaries for plot structure, story-bible updates, generated prose, and overall coherence/quality.
* Decide what execution metadata and artifacts an eval run must capture.
* Define how an admin-facing eval workflow should conceptually fit into the UI/system.
* Evaluate whether an existing eval framework is architecturally useful or a lightweight custom runner is sufficient.
* Describe local persistence and future Postgres/S3 persistence responsibilities without implementing them.

## Deliverables

* Revised eval architecture docs.
* Defined eval entities, run lifecycle, artifacts, metadata, and review flow.
* Initial evaluation dimensions/rubrics to carry into implementation planning.
* Documented relationship between evals, model/workflow comparison, and cost/latency instrumentation.
* Open questions and unresolved choices.

## Open questions

* Existing eval framework or custom runner?
* What should the first eval dimensions/rubrics be?
* Should LLM-as-judge be part of the architecture, and how should it be calibrated?
* Should any evals eventually run in CI, or initially only through an admin workflow?
* What belongs in local storage, structured database storage, and object storage?
* Is a three-scene short story the right default end-to-end fixture?
