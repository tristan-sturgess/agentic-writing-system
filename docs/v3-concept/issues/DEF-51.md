# DEF-51 — Revise architecture for durable long-running agent workflow orchestration

- URL: https://linear.app/tristansturgess/issue/DEF-51/revise-architecture-for-durable-long-running-agent-workflow
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Revise the V2 architecture docs to define how V3 should handle long-running agent workflows reliably, especially once workflows run for many minutes or move beyond a purely local process.

This issue is architecture/documentation work only. Do not introduce a new orchestration framework or persistence layer here.

## Architecture work

* Document how V2 currently executes LangGraph/agent workflows and where failure/restart risks exist.
* Identify which classes of workflow need durable execution versus simple in-process execution.
* Define desired checkpoint, retry, resume, cancellation, and failure semantics.
* Evaluate architectural options, including LangGraph persistence/checkpointing plus a lightweight job layer versus a dedicated workflow orchestration framework.
* Describe how execution state would interact with local storage and future hosted storage.
* Keep simple/short workflows lightweight in the proposed architecture.

## Deliverables

* Revised workflow-execution architecture docs.
* Defined durability boundaries and lifecycle semantics.
* Comparison of viable orchestration approaches and a documented decision or decision criteria.
* Explicit local-development and future-hosted execution model.
* Open questions carried into implementation planning.

## Open questions

* Is a dedicated orchestration framework necessary?
* Which workflow steps should be durable checkpoints?
* Where should execution state live locally and when hosted?
* Which orchestration capabilities are required in the initial V3 architecture versus intentionally deferred?
