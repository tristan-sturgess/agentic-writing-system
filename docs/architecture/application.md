# Application layer

This is what the Python API does and what the frontend gets from it. The API is the service every request enters: it turns a request into a user, checks ownership, calls the stores and the Story Bible layer, builds and invokes agents, streams a turn, delivers a stop, and runs the background routines. The frontend is a separate build that speaks only this contract. It never opens a store, never builds an agent, and never holds a secret.

This doc owns the contract and the service. It does not own the subsystems it calls. The Story Bible doc owns the rules a commit checks; the persistence doc owns the commit and the stores; the agents doc owns the tools and what a cancelled turn leaves in the thread; the model-configuration doc owns configs and the agent builder; the logging doc owns the call record; the evaluations doc owns the run. Where this doc names one of their rules, it is saying where the API calls it, not restating it.

Settled items 34 and 39–41 in [open-questions.md](../open-questions.md) fix the shape: a Python API with a separate frontend, a turn as a job with a durable row and a row-based stop, a stream of typed events over SSE, and the background routines in the service process. This doc states them. Question 33, how a hosted request authenticates, is placed here and not closed.

## The service

The service is one Python process: an ASGI application serving HTTP and SSE, with the turn tasks, the heartbeat, the retention routine, and the evaluation runner as tasks on its event loop. There is one kind of process, and one `instance_id` per process, generated at start and stamped on every call record, turn row, and run row it writes. Which ASGI framework serves the routes is a packaging choice, like Poetry, and belongs to the contributor guide; the contract below does not depend on it.

Locally the service also serves the built frontend as static files from the same port, so the local app is one process started by one command, and the frontend and the API share an origin. Hosted, Railway runs the same process. Whether the hosted frontend is served from the service or from a static host is a deployment detail; the API does not change.

The service holds no story state between requests. A story lives in the store and changes only by a commit. The in-process state the service does keep is the set of running turn tasks and their event buffers, and both are allowed to die with the process, as item 39 says. Nothing above a row is relied on for consistency.

Version 2's application was the NiceGUI process. The UI framework owned the wire, the chat ran as a task inside it, and background work was tracked by a process-wide singleton whose records lived in memory. The screen polled that singleton on a timer. That tied the application to one process and one framework, and it is the shape item 34 declines. What that design had right, an `asyncio` task for the chat turn and a live buffer a page could re-attach to on mount, is kept here as the turn task and the replay buffer.

## A request becomes a user

Every request is resolved to a `user_id` at the edge, before any handler, store, or agent is touched. The handler receives that id and passes it on every store call, as the persistence doc requires. There is no user id in a URL or a request body. A request that names a story, a conversation, a config, or a run is acting as the resolved user, and the store's ownership check decides whether that user may see it.

The resolver is an adapter chosen when the service starts:

- The local resolver returns the one implicit user, created on first run. Every request is that user. There is no login screen.
- The hosted resolver turns a credential on the request into a `user_id`, or rejects the request with `401`. Which credential, and which provider issues it, is question 33. The adapter's output is the same `user_id` the local resolver returns, and nothing below the edge knows which resolver ran.

The service refuses to start with the local resolver unless it is configured as a local install. A hosted deployment that forgot to configure authentication fails at startup rather than serving every request as the implicit user.

Ownership is the persistence doc's rule: a story, a conversation, a config document, a fixture, and a run belong to one user, and a store call by another user does not return them. The API reports a resource the acting user does not own as `404`. For the acting user, it does not exist.

## The contract

The contract is JSON over HTTP, plus one SSE stream for a turn. Ids are opaque strings. Times are ISO 8601 in UTC. The paths below are the working names; a prefix such as `/api` is a packaging detail. The resources and their outcomes are the contract.

A request body is validated against a schema before the handler runs. A body the schema rejects is `400`, naming the field. A schema the body passes and a rule then refuses is the subsystem's outcome, mapped as follows.

A commit has three outcomes in the persistence doc, and the API returns them as three responses:

| Outcome | Status | Body |
| --- | --- | --- |
| Committed | `200` | The `commit_id` and the new revision of every row the commit touched. For a create, the minted id. |
| Refused | `422` | The refusal from the Story Bible layer: the message, the field or record it names, and the legal ids for that kind. Nothing was written. |
| Conflict | `409` | The rows that moved since the request's revisions, each with its current state. Nothing was written. |

A busy error that outlives the store's retries is `503`, and the frontend may retry. The frontend holds the writer's edit on the screen through all four, as the persistence doc requires, and shows the current record beside the edit on a conflict.

### Slice 2

The first endpoints. Slice 2 builds these and the frontend that calls them. In this slice every commit is a hand edit, an import, or a revert.

| Method and path | What it does |
| --- | --- |
| `GET /stories` | The acting user's stories: id, title, created and updated times. The store's `list`. |
| `POST /stories` | A new empty story. The store's `create`. Returns the story as `GET /stories/{story_id}` would. |
| `GET /stories/{story_id}` | The whole story document, every record with its revision, from one `load`. This is what the frontend draws from. The revisions are what its next commit carries. |
| `DELETE /stories/{story_id}` | Removes the story, its records, its history, and its conversations. The store's `delete`. |
| `POST /stories/{story_id}/commits` | One commit, source `user`. The body is an ordered list of writes: create, update, or delete of one record, or a change to the framing fields or `unit_ids`, each update and delete carrying the revision the frontend loaded. A later write may name what an earlier one created. The three outcomes above. |
| `GET /stories/{story_id}/history` | The commit records, newest first, with the persistence doc's filters: source, `thread_id`, `run_id`, a time range. Each record carries its changes with the before and after. Grouping by turn is grouping by `thread_id` and `run_id`. |
| `POST /stories/{story_id}/revert` | A revert commit. The body names commit ids, or a `thread_id` and `run_id` for a whole turn. One commit; it lands whole or not at all, with the three outcomes above. |
| `GET /stories/{story_id}/export` | The story's export document, as the persistence doc defines it. No revisions, no history, no conversations, no application data. |
| `POST /stories/import` | A new story from an export document. The import is a commit; a refusal is `422` and nothing is created. Returns the new story. |

A per-record read is not needed for the pictures, because `GET /stories/{story_id}` is one consistent snapshot and the frontend edits from it. One may be added when a view wants it; it is a projection of `load`, not a new store operation.

### Slice 3

The arc chat is the first endpoint that streams and the first that has to carry a stop to a running turn. Slice 3 adds these and the stores behind them.

| Method and path | What it does |
| --- | --- |
| `GET /stories/{story_id}/conversations` | The conversation rows for a story: id, created time, and the latest turn's id and status. |
| `POST /stories/{story_id}/conversations` | A new conversation row on this story for the acting user. The thread is created when the first turn runs. |
| `GET /conversations/{conversation_id}` | The row and the transcript: the thread's messages, projected to the same types the stream carries. User messages, assistant text, tool calls, tool results. There is no system message in the thread, and none is projected. |
| `DELETE /conversations/{conversation_id}` | Removes the row and the thread. A conversation with a running turn is refused with `409`. |
| `POST /conversations/{conversation_id}/turns` | Starts a turn. [A turn](#a-turn) below. |
| `GET /turns/{turn_id}` | The turn row, with `interrupted` derived from the heartbeat. |
| `GET /turns/{turn_id}/events` | The SSE stream. [The stream](#the-stream) below. |
| `POST /turns/{turn_id}/stop` | Requests a stop. [The stop](#the-stop) below. |
| `GET /configs`, `GET /configs/{config_id}`, `PUT /configs/{config_id}`, `DELETE /configs/{config_id}` | The config store's list, get, save, and delete, with the model-configuration doc's rules: a role is edited in place and a delete restores its seed. |
| `GET /configs/nodes` | The node registry: each node id, its description, its default role, and the acting user's selection, resolved. The selector is drawn from this. |
| `PUT /configs/nodes/{node_id}` | The store's select. An unknown node or a missing config is `422`. |
| `GET /configs/export`, `POST /configs/import` | The config document as one JSON file, under that doc's import rules. |
| `GET /key` | Whether the acting user has an API key stored. Never the key. |
| `PUT /key` | The secrets store's `set`. The body is the key; the response says it is set. |
| `DELETE /key` | The secrets store's `delete`. |
| `GET /calls` | The call list, newest first, with the logging doc's filters. Each `running` record carries `interrupted`, derived by the API from the heartbeat rows so the frontend never reads them. |
| `GET /calls/{call_id}` | One record, with the prompt as structured messages. The frontend escapes markup before rendering. |
| `DELETE /calls` | The user's "clear log": the persistence doc's one deletion routine, for this user's uncited records. |

The heartbeat is not an endpoint. It is a routine in [Background routines](#background-routines), and `interrupted` on a turn or a call is the API reading what it wrote.

### Slice 4

| Method and path | What it does |
| --- | --- |
| `GET /fixtures`, `GET /fixtures/{fixture_id}` | The acting user's fixtures and their versions. |
| `PUT /fixtures/{fixture_id}` | `put_fixture`: a new fixture, or a new immutable version of one. |
| `POST /runs` | Launches a run: the fixture id and version, the workflow, and optionally a `config_id`. Creates the story and the conversation, writes the run row at `running`, and starts the run task. Returns the run id. |
| `GET /runs`, `GET /runs/{eval_id}` | Runs, newest first, with the evaluations doc's filters. A `running` run carries `interrupted`. |
| `POST /runs/{eval_id}/stop` | Stops the run: a stop on its current turn, and no further fixture message is sent. The run's status becomes `cancelled` when that turn has ended. |
| `POST /runs/{eval_id}/scores` | A human score on a finished run. `add_score` with source `human`. |
| `POST /runs/pairs` | The optional pairwise comparison of two runs on one fixture version. `add_pair`. |
| `GET /fixtures/{fixture_id}/versions/{version}/comparison` | The runs of that fixture version lined up as the evaluations doc's comparison: version, hashes, binding, status, checks, scores with notes, usage, and the bible copies. The API lines them up; the frontend draws them. |

The run task is the turn task called once per fixture message with the run's `workflow_run_id` in the context, then the checks and the judge, as item 41 says. A run is a sequence of turns on one conversation, each with its own turn row, so the run and the chat share one lifecycle and one stop.

## A turn

A turn is a job the service owns. It has a durable row and a task that is not durable.

### The row

| Field | Role |
| --- | --- |
| `turn_id` | Key. Assigned by the store. |
| `conversation_id`, `story_id`, `user_id` | The conversation the turn runs on, its story, and the acting user. |
| `run_id` | The id the service minted for this invoke and put in the config, as the logging doc requires. The call records and the commit records of this turn carry the same value. |
| `workflow_run_id` | Empty for the chat. The evaluation run's id when the runner started this turn. |
| `instance_id` | The process running the task. |
| `status` | `running`, then `success`, `error`, or `cancelled`. |
| `stop_requested_at` | Empty until the stop endpoint writes it. |
| `ended_by` | For `cancelled`: `stop` or `recursion_limit`. Empty otherwise. |
| `started_at`, `finished_at` | When the row was written and when the status left `running`. |
| `error` | The exception text when `status` is `error`. |

The row lives in the application database beside the conversation rows, `data/app.sqlite` locally and Postgres hosted. The turn store is `start_turn`, `request_stop`, `finish_turn`, `get_turn`, and `list_turns` for a conversation, each scoped by `user_id`. `request_stop` sets `stop_requested_at` if it is empty and changes nothing else. `finish_turn` sets the status, `ended_by`, `finished_at`, and `error`. Only the task that owns the turn calls `finish_turn`.

The status records what happened, not what was asked. A stop request is visible in `stop_requested_at`; `cancelled` is written by the task after the thread is closed. A turn whose process died stays `running` in the store, and the API reports it as `interrupted` under the heartbeat rule: its `instance_id` has no heartbeat in the last 90 seconds, or no heartbeat row at all. `interrupted` is derived on read and never stored.

### Starting a turn

`POST /conversations/{conversation_id}/turns` carries the user's message and, when the frontend has one, the note about what the writer has open. That note becomes a content block on the user message, as the agents doc says; it travels on this request and not on the stream.

The handler, in order:

1. Resolves the conversation row for the acting user. Not theirs is `404`.
2. Checks that the conversation has no turn at `running`. A thread has one invoke in flight; a second prompt is `409` with the running turn's id, and the frontend waits or stops it. An `interrupted` turn is not running and does not block.
3. Resolves the `chat` node to a binding through the model-configuration doc's resolution, for this user. No API key is `422` before any call is made.
4. Builds the agent through the shared builder with the logging context: `user_id`, `story_id`, `workflow` `chat`, `node_id` `chat`, the resolved `config_id`, and an empty `workflow_run_id`. The builder's fixed middleware list applies: the prefix first, the stop check from [The stop](#the-stop) between, the logging middleware last.
5. Mints a `run_id`, writes the turn row at `running` with this process's `instance_id`, and starts the task on the event loop.
6. Returns `201` with the turn id. When the request accepts `text/event-stream`, the response is the stream itself, from sequence 1, so the common case is one round trip. The frontend can drop that response and `GET /turns/{turn_id}/events` later; the turn does not notice.

The task invokes the agent on the conversation's `thread_id` with `run_id` in the invoke config and the agents doc's `recursion_limit`, consumes the LangGraph stream, emits the events in [The stream](#the-stream) into the turn's buffer, and when the invoke returns, writes the terminal event and calls `finish_turn`. The task writes nothing to the story. The write tools commit, as the agents doc says, and the task only reports what they returned.

A turn is not an HTTP connection. A held request, where the turn lives as long as the response does, was set aside in item 39: a refresh or a proxy timeout would have ended a long arc run that had already committed half its writes. Here the task runs to its end whether or not anyone is subscribed.

### The stop

`POST /turns/{turn_id}/stop` calls `request_stop` and returns `202` with the row. It is idempotent. On a turn that has already ended it returns the row unchanged. It does not write `cancelled`, and it does not signal the task. The row is the signal.

The running turn reads its row at each superstep boundary. The check is a middleware the service supplies to the shared builder, with `before_model` and `after_model` hooks in sync and async form, like the other two. Before a model call, if `stop_requested_at` is set, the hook ends the run without calling the model. After a model call, if `stop_requested_at` is set and the call requested tools, the hook appends a tool result for each requested call saying the turn was cancelled and ends the run, so no tool in that batch runs and the thread is valid for the next prompt. A tool batch already running finishes and its commits stay; the check after it catches the stop before the next model call. That is the agents doc's cancellation, and the row read is how the stop reaches it. The same hooks close the thread when the recursion limit ends the run, so every tool call the model requested has a result either way.

The task then emits `cancelled` and calls `finish_turn` with `cancelled` and `ended_by`. The stop reached the replica running the turn by a row that replica already reads, with no routing and no message bus; a replica that is not running the turn never sees the request, and does not need to. One read per superstep is the whole cost.

Version 2 stored `cancel_requested` on its job and nothing read it. The check is the requirement, and here it is a hook on the agent, not a flag beside it.

## The stream

`GET /turns/{turn_id}/events` is Server-Sent Events. Each event has an `id` that is its sequence number within the turn, starting at 1, an `event` that is one of the types below, and `data` that is one JSON object. The service writes an SSE comment line every 15 seconds while the turn runs so a proxy does not close an idle connection.

| Event | Data | When |
| --- | --- | --- |
| `assistant_delta` | `text` | A chunk of the assistant's reply. The frontend appends it to the reply. |
| `tool_call` | `tool_call_id`, `name`, `arguments` | The model requested a tool. Emitted when the model call that requested it completes. |
| `tool_result` | `tool_call_id`, `status`, `result` or `error` | The tool returned. `status` is `success` or `error`, the same two the call log's `tool_call` record stores. |
| `commit` | `commit_id`, `record_ids`, `tool_call_id` | A write tool's commit landed. Emitted after that tool's `tool_result`, from the commit id and record ids the tool returned. The frontend refreshes those records without reloading the story. |
| `cancelled` | `ended_by` | The turn ended by a stop or the recursion limit. Terminal. |
| `error` | `message` | The invoke raised. Terminal. |
| `done` | nothing | The turn finished. Terminal. |

The service consumes LangGraph's stream and maps by message type: an assistant chunk is `assistant_delta`; a completed assistant message's `tool_calls` are `tool_call` events; a tool message is `tool_result`, and a `commit` when its result carries a commit. A system message has no event type, so it cannot reach the transcript. That is the prompt-assembly doc's rule enforced on the wire. The frontend never sees a LangGraph message, and the filter is not its job. Forwarding LangGraph's stream modes was set aside in item 40 for that reason: it would have put the filter in the frontend, against LangGraph's shapes, which is how version 2 rendered a system prompt as assistant text.

`tool_call` and `tool_result` carry the same fields as the call log's `tool_call` record, so the transcript and the debug view agree. The frontend renders `assistant_delta` as the reply. Whether it also shows `tool_call` and `tool_result` is a rendering choice, item 25. `commit` is why the events are typed: the writer edits the same bible while the agent runs, and the frontend learns which records moved without polling the story.

The service keeps a turn's events in an in-process buffer while the turn runs. A subscriber that connects partway, or reconnects after a drop, sends the last sequence it saw as `Last-Event-ID` and receives the events after it, then the live ones. With no `Last-Event-ID`, it receives the buffer from the start. The buffer is kept for a short grace after the terminal event, long enough for a subscriber mid-reconnect, and is then dropped. A subscription to a turn whose buffer is gone receives one terminal event built from the row, `done`, `cancelled`, or `error`, and the connection closes; the transcript is in the thread at `GET /conversations/{conversation_id}`, and the frontend reads it from there. A subscription to an `interrupted` turn receives `error` with that reason.

The buffer is not durable and is in one process. A subscriber reaches the process running the turn, which in the local install and in the single-replica hosted shape is the only process. Fanning a stream across replicas is deferred with the rest of hosting, as item 39 says.

SSE over a WebSocket: the stream is one-way, the stop is its own request, resume is `Last-Event-ID`, and no connection upgrade has to pass a proxy.

## Background routines

The routines run as tasks on the service's event loop, locally and hosted. There is no worker process and no queue, and the local install stays one process.

| Routine | Started by | What it does |
| --- | --- | --- |
| Heartbeat | Lifespan | Writes the instance's heartbeat row to the call-log store at start and about every 30 seconds, as the persistence doc defines it. The `interrupted` rule on calls, turns, and runs reads these rows. |
| Retention | Lifespan | The persistence doc's one deletion routine: heartbeat rows older than a day, and on Railway uncited call records older than 90 days. Runs at start and then once a day. It is one idempotent delete that excludes the cited ids, so two replicas running it at once do no harm. |
| Turn task | `POST .../turns` | [A turn](#a-turn). One task per turn, on the instance that accepted the request. |
| Evaluation run | `POST /runs` | The turn task once per fixture message, then the checks and the judge. One task per run. Its row carries the instance like a turn's. |

A task dies with its process. The row says so: the turn or run stays `running` in the store and is read as `interrupted`. The story is consistent because every change was a commit, and the agents doc's thread rules mean the next prompt on that conversation is valid once the stale turn is no longer counted as running. On shutdown the service sets `stop_requested_at` on its own running turns and gives them a short grace to reach a boundary; whatever is still running when the process exits is interrupted, and nothing is lost that a commit had not already kept.

A separate worker, with a queue such as Celery and the stream served from the database, was considered in item 41 and set aside. Nothing the early slices run is heavy, and the robustness a worker buys is not what they need. The condition for revisiting it is question 29: when a workflow must resume after a restart, a durable task owner is worth having, and the buffer moves out of process with it. The turn row is the row that resume would be built on.

## What the frontend may never do

- Open a store, a database file, or the data directory. Every read and write is a request to the API.
- Build or invoke an agent, or call OpenRouter. The API builds agents through the shared builder with the logging context; a frontend call would be unlogged and unattributed.
- Hold a secret. The API key goes to `PUT /key` and is never returned. The frontend shows whether one is set.
- Decide who the user is. The user is resolved at the API's edge, and the frontend never sends a user id.
- Render a message it did not receive as a typed event. The stream's types are the whole vocabulary of the transcript.
- Write `cancelled`, or any turn status. It requests a stop and reads the row.

The frontend does own rendering: the two pictures, the structured editors, the history view with its diff and revert, the turn status, the call list, and the comparison. Which framework draws them is question 21, and this doc does not choose it. Whatever is chosen is built separately and speaks only the contract above.

## What stays open

Question 21, the frontend framework, is closed in slice 2. Question 33, the hosted authentication mechanism, is an adapter behind the edge described above and is closed when hosting is built. Question 24, how many conversations the workspace lists, is a frontend choice over `GET /stories/{story_id}/conversations`. Question 29, a workflow that survives a restart, is the condition for a worker and for an out-of-process stream buffer; this doc revises with the persistence doc when that is needed. Fanning the stream across replicas waits with hosting.

## Coverage note

Remove this section after review.

| Source | Disposition | Reason |
| --- | --- | --- |
| Settled items 34, 39, 40, and 41 in [open-questions.md](../open-questions.md) | Kept | The service, the turn row and the row-based stop, the typed SSE stream with its buffer, and the routines in the service process are stated here as the contract and the service. The reasons the alternatives were set aside are carried in one sentence each. |
| Question 33 in [open-questions.md](../open-questions.md) | Placed | The edge resolver, the local implicit user, and the hosted adapter are fixed. The mechanism stays open. |
| [architecture.md](../architecture.md) application-layer paragraphs | Kept | The part's description and the boundary rules are this doc's sections. |
| [v2/architecture_async_jobs.md](../v2/architecture_async_jobs.md) | Adapted | The `asyncio` chat task and the re-attachable live buffer are kept as the turn task and the replay buffer. The in-memory singleton, claims as consistency, the unread cancel flag, the timer-polled UI, and the scene queue are not. |
| The caller named in the logging, agents, persistence, and evaluations docs | Kept | The minted `run_id` and the logging context, the one-run-per-conversation rule and the superstep stop, the conversation row and the heartbeat, and the run launch each have the endpoint or routine that performs them. |
