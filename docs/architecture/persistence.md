# Persistence

This is how a story is saved, who owns it, and what happens when the user and an agent write at the same time. It is also what sits behind the config store, the secrets store, the call-log store, and the conversation thread. The model-configuration and logging docs fix their interfaces. This doc chooses the implementations, locally and on Railway, and names the data directory once.

The Story Bible doc is the authority for what a story contains and which saves it refuses. The agents doc is the authority for how an agent calls tools. A failed run's durable artifact, for the early slices, is the last successful commit.

## Two layers

A store is an adapter over an engine: SQLite locally, Postgres on Railway, a JSON file in a test. It reads and writes rows. One of its operations writes a row only if that row's revision is unchanged. A store does not know the Story Bible's rules.

The Story Bible object sits above the story store. It applies a set of writes to a copy of the story, checks the rules in [story-bible.md](../story-bible.md), and asks the store to save the result. The other stores have the same split with their own callers: the model-configuration layer fills in roles above the config store, the model binding reads the key from the secrets store, the logging middleware and the debug view use the call-log store, and the chat loop uses the conversation thread.

Nothing above a store opens its engine. Swapping SQLite for Postgres changes the adapter and nothing above it. The validation code runs once, in one place, for every engine.

## Ownership

A story is the isolation boundary. Every Story Bible record belongs to one story. A story has one owner, a user. Locally there is one user, created on first run. That user id is still passed into every store call. A second user is an authorization check, not a new shape for a story.

A request acts as one user. A read or a write of a story succeeds only for that story's owner. Slice 1 has no sharing. How a hosted request becomes a user id is authentication, which waits with the UI and API decision in [open-questions.md](../open-questions.md). Every store call takes the user id either way.

The same boundary covers the data that is not a story. Model configs, the API key, call logs, and conversations belong to the user. A conversation also belongs to one story. One user's rows are never returned to another user.

## The data directory

Local files live in `data/` under the application root. The path can be set by an environment variable, so tests and a second local install do not write into the real directory.

| File | What it holds |
| --- | --- |
| `data/app.sqlite` | The user, stories with their current document and revision, config documents, conversation rows, and evaluation runs once Step 9 defines them. |
| `data/checkpoints.sqlite` | LangGraph checkpoints for conversation threads. The checkpointer library owns these tables. |
| `data/call_log.sqlite` | Call-log records and instance heartbeats. Disposable. Recoverable without touching `app.sqlite`. |
| `data/secrets.sqlite` | The user's API key. Never read by an export. |

Nothing above a store opens these files. Copying `data/` is not an export.

On Railway the same stores are tables in one Postgres database, and the checkpointer is the Postgres checkpointer with the tables its setup creates. A Railway bucket holds blobs once prose or other large bodies exist. Slice 1 has no blobs, and it does not need the bucket.

SQLite is the local engine, opened in WAL mode with a busy timeout, so the debug view can read while the middleware writes and a short overlap of two writers waits instead of failing. Postgres is the hosted engine. Callers see the store interfaces below, not the engine. Version 2's `world.json`, rewritten under a process-wide lock, is not this design. A JSON file under a lock can still implement a store in a test. It is not what slice 1 builds.

Async methods of every store do their work off the event loop. A blocking lock or a `sleep` inside an async call would stall every agent sharing that loop. Version 2 retried a file lock with `time.sleep` on the UI thread, and the interface froze for the retry. A transient busy error that outlasts the busy timeout is retried a few times with a short backoff on the worker. When the retries are spent, the call fails, and the screen stays responsive.

## Story store

The story store is the adapter slice 1 codes against. It has five operations and no knowledge of the records inside a story.

A story row holds the story id, the owner id, the revision, and the story document. The story id is assigned by the store and may be opaque. The document is the story in [story-bible.md](../story-bible.md): the framing fields and the records, with a schema version. The revision is an integer. It starts at 1 and increases by one on each successful save.

| Operation | Role |
| --- | --- |
| `create(user_id)` | A new empty story owned by the acting user, at revision 1. |
| `load(user_id, story_id)` | The document and its revision, for a story the acting user owns. |
| `save(user_id, story_id, document, expected_revision)` | Replace the document, only if the stored revision equals `expected_revision`. Returns the new revision, or a conflict carrying the current document and revision. |
| `list(user_id)` | The acting user's stories. |
| `delete(user_id, story_id)` | Remove the story, for its owner. Removes that story's conversation rows and their threads. Call records keep their `story_id`; they are debug data, not story data. |

`save` is one atomic conditional replace: an update guarded by the revision in SQLite and Postgres, a lock, a revision check, and a file replace for a JSON file. It lands completely or not at all. Two saves on one story are ordered by that guard. The second does not overwrite the first in silence. Two different stories can save at the same time.

One row holds one story's current document. The store keeps no history of earlier revisions. An evaluation run that needs the story before and after a workflow copies the document into its own record; the evaluations doc owns that record. A row per record, with a revision per record, is a later refinement behind these same five operations, if a story grows large enough to need it.

## A commit

A commit is the Story Bible layer's algorithm, above the store. Every change to a story goes through it: a user's edit, a tool call, an agent's draft, an import.

1. `load` a snapshot of the story at revision N.
2. Apply the writes to that copy, in order. A write is a create, an update, or a delete of one record, or a change to the framing fields or `unit_ids`. A later write in the set can see what an earlier one created, so several creates can refer to each other. That is the case version 2 broke.
3. Check the resulting document against the rules in [story-bible.md](../story-bible.md): an unknown id, a delete something still names, a Narrative Unit in two lists or inside itself, a blank primary text, a span cycle. A failure returns the refusal, with the legal ids for that kind of record. Nothing was written.
4. `save` with `expected_revision` N. A conflict returns the current story and its revision.

Three outcomes: committed, refused, conflict. A refusal comes from the Story Bible layer, and the document on disk never held the bad state. A conflict comes from the store, and means someone else committed first. The caller decides what to do with either. A tool returns a refusal to the model as a tool message with status `error`. After a conflict, a caller may reload and apply its writes again at the new revision when the records those writes touch are unchanged. A write whose target changed is not reapplied. The caller returns the current record and writes nothing. A write that would now break a rule is refused on the retry.

There is no live object beside the store. Version 2 kept one in-memory world, mutated it, and saved afterward, so a failed save left memory and disk disagreeing and the model's retry then duplicated the phantom change. Here the copy in step 2 is private to the commit and is discarded if the commit does not land.

The screen holds the user's edit until the commit succeeds. The stored story changes only at that commit. A failed commit, including a refusal, a conflict, and a busy error that ran out of retries, leaves the stored story as it was and leaves the edit on the screen so the user can retry or reload. A whole-story revision means an agent's commits during a run move the revision under a user's pending edit. The screen may reload and reapply a single-record edit when that record is unchanged at the new revision, and shows the conflict otherwise. The store does only the revision check.

A user edit and an agent write use this same commit. Version 2 gave rollback to tool calls only.

### Tool calls on one story

Version 2 ran the tool calls of one model message at the same time, against one in-memory world. A later call in the batch could name a record an earlier call had not created yet, or could validate against a half-updated story. The mitigation serialized every tool call in the process. That was correct, and it gave up every other kind of parallelism.

The problem was the shared live object, not the parallelism. Here each write tool call is its own commit against a committed snapshot, so a batch of tool calls can run at once without a gate:

- Two independent writes in one batch. The second one's `save` conflicts. The tool reloads and applies its write again when the records it touches are unchanged at the new revision. If those records changed, the tool returns them and writes nothing. Neither call saw a torn story.
- A dependent batch, where call B names an id that call A creates. If B commits first, it is refused with the legal ids. The model sees A's result in the same tool round and issues B again. That costs a turn, only when the model batched dependent writes.

Independent reads of a story run together. Writes to two stories run together. A middleware that serializes every tool call in the process is not part of this design. Restricting the model's parallel tool calls is a cost choice, and the agents doc declines it. A batch runs, and a dependent call that loses the race is refused and issued again.

### A draft commit

A multi-step agent draft is the same commit with a longer-lived snapshot. The draft holds the writes until one commit, and that commit passes the revision from when the draft started. The story has moved: the commit conflicts, returns the current revision, and writes nothing. The story is still the one the user has. The agents doc says the caller reports that conflict and does not reapply the draft onto the new revision. The plot-draft commit in version 2 is the pattern. The process-wide story-bible claim it also required is not.

If the process dies before that commit, the draft is gone. The draft is in-process state; it is not in the conversation thread's checkpoints. The story stays at the last successful commit. Call records already written stay in the log. Resuming a workflow after a restart, and checkpointing a run that must survive the process, stay open in [open-questions.md](../open-questions.md).

A busy flag in the UI can tell the user a run is in progress. It is not what keeps the story consistent. Version 2's in-memory job claims died on restart and were not a transaction. They are not ported.

## Config store

The config store implements the operations in [model-configuration.md](model-configuration.md): list, get, save, delete, select, resolve, export, and import. One document per user, addressed by user id. The document shape, the four roles, and the import rules stay in that doc, above the store.

Locally the document is a row in `app.sqlite`. On Railway it is a row in Postgres. Each operation that changes the document reads it, changes it, and writes it inside one transaction on that row, so two operations from two tabs do not lose one another's change. The caller does not pass a revision. The export file is still the JSON document that doc describes. The export is a serialization, not a copy of the database.

## Secrets

The user provides their own OpenRouter API key. The secrets store is `set`, `get`, and `delete` for the acting user's key. The model binding in [model-configuration.md](model-configuration.md) reads the key through `get` when it builds a chat model. Nothing else reads it.

The key is not a field on the config document. It is not written into a story export, a config export, or a call record. Locally it is a row in `data/secrets.sqlite`, in plain text; the local install is the user's own machine, and the separate file keeps the key out of a copied `app.sqlite`. On Railway it is a row in its own table, encrypted by the application with a key from the environment before it is written, so a database dump does not contain usable keys. Platform encryption at rest protects the disk, not a dump. No export query reads that table. The screen that collects the key waits with the UI choice in [open-questions.md](../open-questions.md).

## Conversations

A conversation is a LangGraph thread. The chat agent from `create_agent` is compiled with a checkpointer, and the conversation's id is the `thread_id` it is invoked with. The transcript the workspace shows is that thread's state. There is no second message table. The logging doc's `thread_id` is this id.

The app keeps a conversation row in `app.sqlite`: the conversation id, the owner, the story, and a created time. The checkpointer's tables carry no user or story, so that row is the scope. A request resolves a conversation through its row, and the owner check happens there, before the agent is invoked with that `thread_id`. A thread has one invoke in flight. A second prompt on that conversation waits until the run has ended, as the agents doc says. Story edits during the run are commits, and they do not start a second invoke. The store allows more than one conversation per story. The agent runs on the conversation it was given. Whether the workspace lists more than one stays open in the agents doc.

Locally the checkpointer is the SQLite checkpointer on `data/checkpoints.sqlite`. On Railway it is the Postgres checkpointer. Each is its async form for the streaming chat path and its sync form for a sync caller. The sync saver does not implement the async methods, so the chat loop, which streams, needs the async one. This is the same rule as the middleware hooks. The library's setup creates its tables; the app does not define them.

Deleting a conversation deletes its row and its thread. Deleting a story deletes its conversations. A conversation is not a Story Bible record. The story export does not include it. Version 2 kept chat in a side file and left it out of the ZIP. The side file had no owner and no story. The exclusion from the export stays.

This checkpointer is conversation memory. It gives the chat agent its history between turns. Using it to resume a workflow after a process restart is a separate decision, open in [open-questions.md](../open-questions.md), and the draft commit above does not depend on it.

## Call-log store

The call-log store implements the interface in [llm-debug-logging.md](llm-debug-logging.md): `start`, `finish`, `get`, and `list`, each in sync and async form. `start` inserts a row keyed by `call_id`. `finish` updates that row. A `finish` for an unknown `call_id` still inserts the outcome. The caller never loads the log to write one record. Two writes of two keys both land, and a row is never torn.

Every read and every list is scoped by `user_id`.

### Instances

A process generates an `instance_id` when it starts and keeps it until it exits. It writes a heartbeat row in the call-log store at start and about every 30 seconds, with that id, the start time, and the time of the heartbeat. The rows live with the call log because only the debug view reads them, and they are the most disposable data the app has.

The view's rule: a `running` record is interrupted when its `instance_id` has no heartbeat in the last 90 seconds, three missed beats, or has no heartbeat row at all. A crash never writes a stop row, so staleness is the rule, and a replica that scaled down looks the same as one that died. A local run is one process and uses the same heartbeat, so the view has one rule. Heartbeat rows older than a day are deleted by the same routine that handles retention.

### Recovery

Call logs are disposable. Story data is not, which is why the log has its own file.

A busy error is not corruption. `database is locked` is retried as [The data directory](#the-data-directory) says, and never triggers the recovery below. Otherwise a healthy log would be renamed under a concurrent writer.

If `call_log.sqlite` cannot be opened, or is not a valid database, the store renames it to `call_log.sqlite.unreadable-<utc timestamp>`, creates a new empty log, and continues. A row that cannot be read is skipped. The failure is logged. It is not raised to the middleware, and it does not stick: the next call uses the new log. `app.sqlite`, `checkpoints.sqlite`, and `secrets.sqlite` are not renamed by this recovery. If any of those cannot be opened, the app reports that and does not discard them.

On Railway a failed read of the log does not latch the store into a failed state. The middleware already swallows a store error. The next call tries again.

### Retention

A record an evaluation run cites is kept. The evaluation store records the cited `call_id`s. One deletion routine removes call records, whether an age job or the user's "clear log" runs it, and it excludes every id the evaluation store cites. The log store itself has no delete that bypasses that routine. The evaluations doc says what a run cites. It does not choose a second retention rule.

The local log has no count cap and no age cap. Version 2 kept the newest 200, which would have dropped records a later evaluation still named. The user can clear the log, which removes that user's uncited records.

On Railway, the routine may delete uncited records older than 90 days. Cited records stay while the run that cites them stays. A user clearing the log deletes that user's uncited records only.

## Export and import

A story export is a serialization of that story's document, for a story the acting user owns. It includes the schema version. It does not include other stories, configs, the API key, call logs, or conversations.

Slice 1 has no prose, so the export is one JSON document. When prose exists, the export can be a zip with that document and the prose blobs. Version 2's zip was `world.json` plus scene files because the prose lived beside the world. The extra members, when they exist, are the blobs. The exclusion list does not change.

Secrets stay out. Version 2's export also left out model profiles, and that stays: configs have their own export, in the model-configuration doc.

Import checks the schema version and fails with a clear error when it does not match. Slice 1 does not migrate an older export. A successful import is a `create` followed by one commit of the file's contents, checked by the same rules as any commit, so a file with a duplicate id or a dangling reference is refused before anything is written. Record ids from the file are kept. The new story is owned by the acting user and has a new story id. Import does not replace an existing story. Version 2 had one world, so import replaced it.

## What stays open

Workflows that must survive a process restart stay open in [open-questions.md](../open-questions.md). Until that is decided, a run lives in the process. The story does not hold a half-applied draft.

Which interface the user sees, and how a hosted request authenticates, are still open there. These stores can be called from a Python API or from the same process. That choice does not change the ownership model.

## Coverage note

Remove this section after review.

| Source | Disposition | Reason |
| --- | --- | --- |
| [deployment-and-concurrency.md](../deployment-and-concurrency.md) | Adapted | The write rules, the story boundary, Railway, and Postgres are this doc. The transaction is now split into a store primitive and a Story Bible commit. The old draft stays in place so review can diff it. |
| [DEF-50](../v3-concept/issues/DEF-50.md) storage and tenancy | Kept | Local SQLite and hosted Postgres behind one interface. Owner on every story. Secrets out of exports. The UI, the frontend split, and authentication stay open. |
| [DEF-51](../v3-concept/issues/DEF-51.md) | Left open | The early durable artifact is the last successful commit. The chat agent's checkpointer is conversation memory. Checkpoint and resume for workflows stay open. |
| [v2/architecture.md](../v2/architecture.md) world state and the file lock | Adapted | The commit and the revision check replace the in-memory world and the process lock. The agents doc took the tool boundary. The module map is the overview's. |
| [v2/architecture_async_jobs.md](../v2/architecture_async_jobs.md) | Adapted | Claims are not the consistency mechanism. The in-memory job manager and the scene queue are not ported. |
| [v2/known_issues.md](../v2/known_issues.md) items 2, 3, and 9 | Kept | Chat is per user and story and stays out of the export. User edits commit through the transaction. A retry does not run on the UI thread. |
| The rest of that known-issues list | Left | The agents doc took the blocked plot turn, the unwired cancel, and the markup leak. The prose salvage still owes the fuzzy match and the canvas rollback. |
| [v2/zip_import_export.md](../v2/zip_import_export.md) | Adapted | The export is the story, not the installation. Slice 1 is one JSON document. The zip returns with prose blobs. Import creates a new story through the commit. |
