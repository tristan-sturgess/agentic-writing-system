# Architecture

This is the map of the system: what the parts are, and which document is the authority for each one. A rule is repeated here only where the map would mislead without it. When this page and a subsystem doc disagree, the subsystem doc is right and this page is fixed.

## The parts

| Part | What it is | Authority |
| --- | --- | --- |
| The product | A workspace for writing fiction. The writer describes a story, agents turn it into a Story Bible and later into prose, and the writer inspects, edits, and steers. | [vision.md](vision.md) |
| Story Bible | The shared state. One story holds its framing fields and its Entities, Properties, Assertions, Events, Narrative Units, and Arcs. Readable frozen ids. Dangling references refused. Story time is the span list on a Property, an Assertion, or an Event. | [story-bible.md](story-bible.md) |
| The commit | The one path every change to a story takes: load a snapshot, apply the writes, check the Story Bible rules, save a changeset guarded by the revision of each record it touches. Committed, refused, or conflict. A user's edit, a tool call, a draft, an import, and a revert all use it. Every commit leaves a history record with before-images, and a revert is a commit built from one. | [architecture/persistence.md](architecture/persistence.md) |
| The application layer | A Python API. The service every request enters: it resolves the user, checks ownership, resolves a conversation row, builds and invokes agents with the logging context and a minted `run_id`, streams the turn as typed events, delivers a stop by a row the running turn reads, and runs the turn task, the evaluation runner, the heartbeat, and the retention routine in its own process. The frontend is a separate build that speaks only this contract. | [architecture/application.md](architecture/application.md), which states settled items 34 and 39–41 in [open-questions.md](open-questions.md). |
| The frontend | A client of the API, in a framework still to be chosen. It draws the two pictures, edits every record as structured fields, shows the history and the call list, and renders assistant text from the stream. It never opens a store or builds an agent. | Question 21 in [open-questions.md](open-questions.md). The requirements are in the subsystem docs. |
| Stores | Adapters over an engine: SQLite locally, Postgres on Railway. The story store holds a row per record with its own revision, so unrelated writes never conflict. The config store, the secrets store, the call-log store, the conversation thread, and the evaluation store sit beside it. Every call takes a user id. A story is the isolation boundary and has one owner. | [architecture/persistence.md](architecture/persistence.md) |
| Tools | The only way an agent reads or changes a story. A write tool is one commit. A refusal is an error tool result the model corrects; it is not retried blindly. Leaked tool-call markup is refused. | [architecture/agents.md](architecture/agents.md) |
| The arc-planning chat | The first workflow. One `create_agent` agent on the registry node `chat`. It writes framing, Entities, Properties, Assertions, Events, and Arcs, one commit per tool call. No prose, no Narrative Units, no nested planner. Cancellable at a superstep boundary. | [architecture/agents.md](architecture/agents.md) |
| Model configuration | Per-user configs for OpenRouter models, four role configs always present, a node registry, and resolution from the user's selection to a role to `orchestration`. A system-prompt prefix rides on every call that uses a config. | [architecture/model-configuration.md](architecture/model-configuration.md) |
| Prompt assembly | Which layer a piece of context belongs in: prefix, base prompt, Story Bible context through tools, conversation. Static text stays on the model request, not the message channel. A stream consumer renders assistant chunks as the reply and nothing else as the reply. | [architecture/prompt-assembly.md](architecture/prompt-assembly.md) |
| Call logging | One `wrap_model_call` middleware, last in the list, records the request the provider receives and the response. A `tool_call` record for each tool invocation. Debug data, scoped by user, never in a story export. | [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md) |
| Evaluations | A fixture, a run, deterministic checks, a three-dimension judge scored 1 to 5, and a comparison of runs on one fixture. Cost and latency are read from the cited call records. No budget, no CI. | [architecture/evaluations.md](architecture/evaluations.md) |
| Build sequence | Five slices: Story Bible, editing and visualization, arc chat with the model-call subsystems, evaluations, prose. The prose slice carries the deferred version 2 salvage. | [build-sequence.md](build-sequence.md) |
| Open questions | Every decision still deferred, each naming the doc that closes it, and the settled list so nothing is reopened. | [open-questions.md](open-questions.md) |

## How they fit

```text
                 Writer
                   │
               frontend ── separate build, speaks only the API
                   │
              Python API ── the application layer: user, owner, run_id, stream, stop
          ┌────────┴─────────┐
       hand edit          prompt
          │                  │
          │           arc-planning chat ── create_agent, node `chat`
          │                  │              middleware: prefix … logging
          │                tools  ─────────────────────────┐
          │                  │                             │
          └──────► Story Bible layer ◄──── import          │
                      (commit)                             │
                         │                                 ▼
                    story store                     call-log store
                         │                                 ▲
                   SQLite / Postgres                       │
                                                      evaluation run
                                              cites call_ids, copies the bible
```

A writing turn: the writer sends a prompt on a conversation, and the frontend sends it to the API. The API resolves the user, the story, and the conversation row, resolves the `chat` node to a config, builds the agent through the shared builder with the context the logging doc names, and invokes it on that thread. The model reads the bible through tools and writes through tools. Each write is a commit. Each model call and each tool call is a record in the call log. The stream carries typed events to the screen: the assistant text, the tool calls and results, and a `commit` event for each write so the frontend knows which records moved. The writer can edit the bible by hand during the run; those edits are commits on the same story.

An evaluation run is that same agent, driven by a runner against a fixture, with a `workflow_run_id` so the calls can be found. The run copies the bible before and after, runs the checks against the bible and the tool records, runs the judge on the `judge` node, and cites the call records for tokens, cost, and latency.

## Boundaries the map depends on

- Python is the application and agent language. The agent layer is LangChain's `create_agent` on LangGraph. Every model call, including a one-shot structured call and the evaluation judge, is an agent from one shared builder with one fixed middleware list: the prefix middleware first, the logging middleware last, each with its sync and async hook. There is no second call path. A fixed-order workflow, when one is needed, is a LangGraph graph whose nodes are those agents. Pydantic defines the record and tool schemas, as it did in version 2. The API is FastAPI, and the stores use SQLAlchemy with Alembic migrations. `AGENTS.md` at the repository root lists the full stack.
- The Python application is a service with an explicit API, and the UI is a separate frontend that is a client of it. Every request enters through the API, which resolves it to a user id before any store or agent is touched. The frontend never opens a store, never builds an agent, and never holds a secret. Version 2's in-process UI owned the wire and tied the application to one process; that boundary is not repeated.
- Models are reached through OpenRouter with the user's own key. The key lives in the secrets store and nowhere else.
- An agent never holds a live story object. It reads and writes through tools, and a tool is one commit. The writer's edits use the same commit. The two differ in who calls it, not in what it checks.
- The Story Bible doc owns the rules a commit checks. The persistence doc owns the commit algorithm and the stores. The agents doc owns the tools that call it.
- A store is an interface. Nothing above it opens the engine. Swapping SQLite for Postgres is a deployment, not a new ownership model.
- Workflow state is ephemeral. Nothing an agent holds in memory survives a run unless a tool wrote it to the story through a commit. The durable artifact of a run is its last successful commit.
- An agent edits long text with a targeted patch, not by replacing the whole document. When prose exists, a patch names the text to replace and the replacement, and a match that hits nothing or more than one place is an error. The prose note in [build-sequence.md](build-sequence.md) holds the rule.
- Story data and application data are separate. Configs, the API key, call logs, fixtures, and runs belong to the user, not to a story. A conversation belongs to the user and to one story. None of them are in a story export.
- Static prompt text is on the model request. The conversation thread holds only the dialogue, including the note about what the writer has open. The recorded prompt is the request the provider received.

## What is not decided

The frontend framework is open. [open-questions.md](open-questions.md) question 21 holds the choice, and slice 2 of the build sequence closes it before any view is built. React is a candidate. NiceGUI and the other in-process Python frameworks are out, with settled item 34. Whatever is chosen has to draw the two pictures the Story Bible doc requires, edit every record as structured fields, hold a hand edit on the screen until its commit lands, show the commit history with a revert, render assistant text only from the stream, and show the read-only call list and the evaluation comparison. Those requirements are already in the subsystem docs. The framework is not.

The application layer is settled as the Python API, item 34, and [architecture/application.md](architecture/application.md) states it. The subsystem docs already say what that API must call and must not touch, and items 39–41 settle its own shape: a chat turn is a job with a durable turn row and a stop the running turn reads at each superstep boundary; the stream is typed events over SSE with an in-process replay buffer; and the heartbeat, retention, turn task, and evaluation runner all run in the service process, locally and hosted. Authentication (question 33) is placed at the API edge, with the hosted mechanism left as an adapter behind that step. Slice 1 builds its first endpoints from that doc.

Restart durability for a workflow (question 29) and the later candidate exploration and character queries (question 32) are open and are not needed by slices 1–4. There is no review gate before a commit (item 23): the writer's review is the history view and its revert.

## Where the version 3 concept's workstreams landed

The Linear project listed nine workstreams. Each one has a home.

| Workstream | Home |
| --- | --- |
| Overall V3 design and migration model | This page. |
| Local-first and deployment-ready storage, multi-tenancy | [architecture/persistence.md](architecture/persistence.md). The frontend split is settled as the Python API, item 34, owned by [architecture/application.md](architecture/application.md). The authentication mechanism stays open, question 33. |
| Durable long-running workflow orchestration | Open, question 29. The early durable artifact is the last successful commit. |
| Eval-first evaluation | [architecture/evaluations.md](architecture/evaluations.md). |
| Event graph and signal model | [story-bible.md](story-bible.md). Events with spans, relationships as Assertions, no signals. |
| Plot planning around narrative intent | [architecture/agents.md](architecture/agents.md). Direct writes on the arc chat. |
| Plot exploration and character queries | [architecture/agents.md](architecture/agents.md), as later additions. Open, question 32. |
| Context assembly | [architecture/prompt-assembly.md](architecture/prompt-assembly.md). Read tools. |
| Cost, latency, and observability | [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md) for the record, [architecture/evaluations.md](architecture/evaluations.md) for cost per run. No budget. |

Story Space & Timeline stays a separate project. A place is an Entity; routes, whereabouts, and the scrubber are not in this architecture.