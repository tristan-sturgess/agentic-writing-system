# DEF-57 — Revise architecture for V3 cost, latency, and LLM usage observability

- URL: https://linear.app/tristansturgess/issue/DEF-57/revise-architecture-for-v3-cost-latency-and-llm-usage-observability
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Revise the V2 architecture docs so that "faster and cheaper than V2" becomes an explicit architectural requirement for V3, with a defined observability model for measuring LLM usage, latency, and cost once the system is implemented.

This issue is architecture/documentation work only. Do not add instrumentation or benchmarking code here.

## Architecture work

* Document the V2 cost/latency problem, including the high model-call count of representative plot workflows.
* Define which usage and performance metrics V3 should capture conceptually: model, call count, tokens, estimated/actual cost, elapsed time, and major workflow-step breakdowns.
* Define where these metrics belong in the architecture and how they should relate to eval runs.
* Establish initial architectural targets/budgets for simple plot generation and end-to-end story eval fixtures where reasonable.
* Define how model/provider differences, caching, and optional exploration tools should be represented in comparisons.
* Decide whether budget violations should eventually be informational or enforceable in eval/CI workflows.

## Deliverables

* Revised observability/cost architecture docs.
* Defined metrics and attribution boundaries for major workflows and model calls.
* Initial V3 cost/latency goals or, where exact numbers are premature, a documented process for setting them during implementation validation.
* Defined relationship between quality evals and cost/latency measurements.
* Open questions carried into implementation planning.

## Open questions

* What concrete call-count, cost, and latency targets should define success?
* How much V2 benchmarking is worth doing before implementation planning?
* Should budget violations eventually fail evals/CI or remain informational?
* How should costs be normalized across providers, pricing models, and caching behavior?
