# Creative Writing System

This repository is the version 3 build of a creative writing system for fiction. Slice 1 of [build-sequence.md](build-sequence.md) is built, and so is the first step of slice 2; the rest is not. The documents below are the design the build follows.

The Story Bible is the shared object. The user can inspect and edit it directly. Agents do most of the work, with revision loops. Measuring whether a prompt or workflow change actually helped is a requirement, not a follow-up.

## Where to start

Read [vision.md](vision.md) for what the system is, then [architecture.md](architecture.md) for the parts and the doc that owns each one. To start building, read [build-sequence.md](build-sequence.md); slice 1 needs [story-bible.md](story-bible.md) and [architecture/persistence.md](architecture/persistence.md).

## Documents

Paths are relative to `docs/`.

| Path | Question it answers |
| --- | --- |
| [vision.md](vision.md) | What the system is for, how a writing session goes, and what this version is leaving until later. |
| [story-bible.md](story-bible.md) | What the Story Bible stores, how the objects connect, and how user edits differ from agent edits. |
| [architecture.md](architecture.md) | How the pieces fit: boundaries, and which subsystem doc owns each concern. |
| [architecture/model-configuration.md](architecture/model-configuration.md) | How the user selects OpenRouter models and how a system-prompt prefix is applied on every call that uses a config. |
| [architecture/prompt-assembly.md](architecture/prompt-assembly.md) | How a model's prompt is composed, and which kinds of context belong in the system prompt versus a specific message. |
| [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md) | How every model call is recorded, so the record is the prompt and response the model actually saw. |
| [architecture/persistence.md](architecture/persistence.md) | How a story is stored locally, how that maps to Railway and multiple users, and how concurrent updates land. |
| [architecture/agents.md](architecture/agents.md) | How agents read and write the Story Bible, and what the arc-planning workflow is responsible for. |
| [architecture/evaluations.md](architecture/evaluations.md) | What is scored, what an evaluation run stores, and how cost and latency sit on that same run. |
| [architecture/application.md](architecture/application.md) | What the Python API does: how a request becomes a user, how a turn is started, streamed, and stopped, which endpoints each slice adds, and where the background routines run. The frontend is a client of it. |
| [build-sequence.md](build-sequence.md) | The order to implement the system, and which docs each slice depends on. |
| [open-questions.md](open-questions.md) | Decisions still deferred, each one naming the doc that will close it, and the decisions already settled. |

### Background research

| Path | Contents |
| --- | --- |
| [research/model_selection_analysis.md](research/model_selection_analysis.md) | The version 2 survey behind the role configs and seed models in model configuration. A July 2026 snapshot. |

### Related work outside this set

The [Story Space & Timeline](https://linear.app/tristansturgess/project/story-space-and-timeline-d288b09de38f) project covers locations, routes, whereabouts, and a time scrubber. It stays separate until a later decision pulls it in. Until then a place is an ordinary Entity in the Story Bible.

## How these documents were written

The set was written from the version 2 docs and the version 3 concept in Linear, one step per session, each step reviewed before the next. The source snapshots, the import inventory, and the working drafts were removed in Step 13. They remain in git history.

| Step | Work | Status |
| --- | --- | --- |
| 1 | Finalize the document list | Done |
| 2 | Vision | Done |
| 3 | Story Bible | Done |
| 4 | Model configuration | Done |
| 5 | Prompt assembly | Done |
| 6 | LLM debug logging | Done |
| 7 | Persistence, tenancy, and concurrency | Done |
| 8 | Agents and arc planning | Done |
| 9 | Evaluations and observability | Done |
| 10 | Build sequence | Done |
| 11 | Architecture overview | Done |
| 12 | Application layer | Done |
| 13 | Final coverage review | Done |
