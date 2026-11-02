# DEF-55 — Revise architecture for optional plot exploration and character-query tools

- URL: https://linear.app/tristansturgess/issue/DEF-55/revise-architecture-for-optional-plot-exploration-and-character-query
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Revise the V2 architecture docs to define where optional plot exploration and targeted character-perspective reasoning should fit around the core V3 plot-planning workflow.

This issue is architecture/documentation work only. Do not implement exploration agents, multi-model execution, or character-interview tools here.

## Architecture work

* Define when the planner may benefit from exploring multiple candidate plot directions instead of producing a single plan.
* Compare architectural options for candidate generation: repeated sampling, multiple models, or a dedicated exploration subagent/tool.
* Define how candidates should be passed back to the main planner without becoming canonical state automatically.
* Define a character-query/interview capability that receives only the information a character should know at that story point.
* Clarify whether character-query outputs are ephemeral reasoning aids or may ever become persisted notes/signals.
* Define how these optional tools interact with evals, cost controls, and the core planning loop.

## Deliverables

* Revised architecture docs showing these optional capabilities and their interfaces with the planner.
* Defined candidate-exploration lifecycle and decision-support role.
* Defined character-query inputs, knowledge boundary, output semantics, and persistence policy.
* Documented triggers/criteria for when these capabilities should be available or invoked.
* Open questions carried into implementation planning.

## Open questions

* How many candidate directions should be considered when exploration is used?
* Multiple models, repeated sampling, or specialized exploration prompts/agents?
* Should exploration ever run automatically, or only when explicitly requested by the planner/workflow?
* How should candidates be ranked, merged, or filtered?
* What exact knowledge boundary should character queries enforce?
* Should character-query outputs always be ephemeral?
