# Architecture direction

This is the working picture of version 3. It keeps the version 2 boundaries that still fit, and it follows the version 3 concept where the briefing and the Linear issues agree. Items marked open are not decisions.

The version 2 architecture snapshot is [v2/architecture.md](v2/architecture.md). The Linear workstreams are [v3-concept/project.md](v3-concept/project.md).

## Shape of the system

One Story Bible per story is the source of truth. The user and every agent read and write that same model.

```text
User description
      │
      ▼
Chat / workflow agent  ──tools──►  Story Bible  ◄── direct edit ── User
      │                                │
      │                                ├── visualizations
      │                                └── evaluations (later slices)
      ▼
Arc plan in the bible
      │
      ▼
Prose workflow (slice 5) ──► narrative units
```

Early slices stop at the arc plan. The prose box is drawn so the model has a place for it. It is not built yet.

## Retained from version 2

These stay as the working technical choices until a review changes them:

- **Python** for the application and the agent layer.
- **Pydantic** for the Story Bible records.
- **LangGraph** for agent loops and for workflows whose step order should be fixed by the graph rather than left to the model. Version 2 used that split on purpose: a free-form chat agent for open requests, and an enforced graph when the product needs a specific sequence. See [v2/architecture_agent_workflows.md](v2/architecture_agent_workflows.md).
- **Tools as the only way an agent mutates the bible.** The model can hallucinate ids. Tools resolve or reject them and return the valid options. That pattern is in `app/tools/` in the version 2 clone and should be recreated, not loosened.
- **OpenRouter-compatible chat models**, with per-step model choice so a cheap step and an expensive step can differ. Version 2's role split (orchestration, writing, judgment, structure) is the reference. See [v2/model_configuration.md](v2/model_configuration.md).
- **World content fetched for the task**, rather than pasting the entire bible into every prompt. Version 2 already worked this way. The version 3 context-assembly design (DEF-56) can get smarter later. The first arc agent can use explicit read tools.

Poetry is a reasonable default for the Python project because version 2 used it. It is a packaging choice, not an architecture constraint.

## Changed from version 2

- **The bible model** is Draft 2. See [story-bible.md](story-bible.md). The intimacy replay loop is not ported as the core.
- **Planning aims at arcs.** The plot agent reasons from the user's narrative intent and writes entities, events, and arcs. It does not depend on a chain of character interpretations to decide what happens next. That is the main shift in the Linear project description and in DEF-54.
- **The UI is not NiceGUI.** Version 2's three-column NiceGUI app (navigation, editor, chat) is the interaction to learn from: keep the bible in view while talking to the agent. The widget layer fought the visualizations this version needs. Slice 2 chooses the UI. A separate frontend and a Python API is an open option (DEF-50), and it matches a later Railway deployment more cleanly than a server-rendered UI tied to one process.
- **Storage is not one process-global `world.json`.** Version 2's single in-memory `World` singleton cannot host multiple users or multiple stories safely. The story is the isolation boundary. See [deployment-and-concurrency.md](deployment-and-concurrency.md).
- **Evaluation is part of the system**, not a hope that the author notices improvement. See [architecture/evaluations.md](architecture/evaluations.md).

## Arc-planning agent (slice 3)

The first agent workflow:

1. The user gives a description of the story they want.
2. The agent creates the entities, properties, and assertions it needs.
3. The agent proposes one or more arcs and the events those arcs arrange.
4. The user edits the result or sends a revision prompt.
5. The agent updates the bible under the write rules in [deployment-and-concurrency.md](deployment-and-concurrency.md).

Version 2's plot sub-agent is the closest existing workflow. It drafted events in a sandbox, interpreted intimacy as it went, and committed all-or-nothing under a story-bible lock. See the "Plot Sub-Agent" section of [v2/architecture_agent_workflows.md](v2/architecture_agent_workflows.md). Version 3 keeps the sandbox-and-commit idea for a batch of related edits. It drops the inline intimacy interpretation. The intermediate plan format (markdown, structured data, or both) is still open in DEF-54. For the first slice, writing the bible records directly is enough, with the chat transcript as the explanation of why.

Optional later, from DEF-55:

- Exploring several candidate arc directions without making them canon until one is chosen.
- Asking a character-query tool what a character would think, using only what that character could know. Those answers start as ephemeral reasoning. Persisting them is a separate decision.

## Context

The arc agent gets a focused slice of the bible: the entities and arcs relevant to the request, plus the statements in force for that part of the story. Provenance matters once a summarizer sits in front of the planner. Synthesized context has to be distinguishable from stored statements (DEF-56). Slice 3 can pass stored records through read tools and skip the summarizer.

## Prose, when it arrives

Narrative units already exist in the model. Slice 5 adds a workflow that fills them from the arcs and events, then evaluates the prose. The lessons worth keeping, and the ones to leave behind, are the prose note in [build-sequence.md](build-sequence.md).

## Story Space

Locations can be Entities in the bible from slice 1, with Properties and Assertions such as "the bedroom connects to the hallway." The separate location agent, route calculator, and time scrubber are the Story Space project. They integrate later by sharing entity and event ids, with protected physical updates going through that subsystem. Until then, the arc agent and the user edit location entities directly.

## Observability

Every model call in an agent run should be attributable to a story, a workflow, a step, and a model, with token counts, latency, and enough of the prompt and response to debug a bad result. Version 2 logged LLM calls for a debug page ([v2/architecture_llm_debug_logging.md](v2/architecture_llm_debug_logging.md)). Version 3 uses the same kind of record as the raw material for evals and for the cost recorded on a run, in total and per step. There is no budget. The capture path should exist when the agent exists, so those runs are not lost.
