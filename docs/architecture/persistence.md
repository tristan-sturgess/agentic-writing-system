# Persistence

This is how a story is saved, who owns it, and what happens when the user and an agent write at the same time. It is also what sits behind the config store, the secrets store, the call-log store, and the conversation thread. The model-configuration and logging docs fix their interfaces. This doc chooses the implementations, locally and on Railway, and names the data directory once.

The Story Bible doc is the authority for what a story contains and which saves it refuses. The agents doc is the authority for how an agent calls tools. A failed run's durable artifact, for the proof of concept, is the last successful commit.

## Two layers

A store is an adapter over an engine: SQLite locally, Postgres on Railway, a JSON file in a test. It reads and writes rows. One of its operations writes a set of rows only if each row's revision is unchanged. A store does not know the Story Bible's rules. It knows which rows name which other rows, because the layer above tells it, and that is all it checks.

The SQLite and Postgres adapters are written with SQLAlchemy's async engine, through `aiosqlite` locally and `psycopg` hosted, so the two adapters share most of their code; the locking in [Story store](#story-store) is where they differ. Alembic owns the schema of the application's own tables. The LangGraph checkpointers create and own theirs.

The Story Bible object sits above the story store. It applies a set of writes to a copy of the story, checks the rules in [story-bible.md](../story-bible.md), and asks the store to save the result. The other stores have the same split with their own callers: the model-configuration layer fills in roles above the config store, the model binding reads the key from the secrets store, the logging middleware and the debug view use the call-log store, and the chat loop uses the conversation thread.

Nothing above a store opens its engine. Swapping SQLite for Postgres changes the adapter and nothing above it. The validation code runs once, in one place, for every engine.

## Ownership

A story is the isolation boundary. Every Story Bible record belongs to one story. A story has one owner, a user. Locally there is one user, created on first run. That user id is still passed into every store call. A second user is an authorization check, not a new shape for a story.

A request acts as one user. A read or a write of a story succeeds only for that story's owner. There is no sharing. The API in [application.md](application.md) resolves every request to a user id before it calls a store; locally that is the one implicit user. How a hosted request proves who it is from is authentication, which waits with hosting in [future-work.md](../future-work.md). Every store call takes the user id either way.

The same boundary covers the data that is not a story. Model configs, the API key, call logs, and conversations belong to the user. A conversation also belongs to one story. One user's rows are never returned to another user.

## The data directory

Local files live in `data/` under the application root. The path can be set by an environment variable, so tests and a second local install do not write into the real directory.

| File | What it holds |
| --- | --- |
| `data/app.sqlite` | The user, story rows and record rows with their revisions, commit records, config documents, conversation rows, turn rows as [application.md](application.md) defines them, and evaluation runs, as [evaluations.md](evaluations.md) defines them. |
| `data/checkpoints.sqlite` | LangGraph checkpoints for conversation threads. The checkpointer library owns these tables. |
| `data/call_log.sqlite` | Call-log records and instance heartbeats. Disposable. Recoverable without touching `app.sqlite`. |
| `data/secrets.sqlite` | The user's API key. Never read by an export. |

Nothing above a store opens these files. Copying `data/` is not an export.

On Railway the same stores are tables in one Postgres database, and the checkpointer is the Postgres checkpointer with the tables its setup creates. A Railway bucket holds blobs once prose or other large bodies exist. There are no blobs yet, and nothing needs the bucket until there are.

SQLite is the local engine, opened in WAL mode with a busy timeout, so the debug view can read while the middleware writes and a short overlap of two writers waits instead of failing. Postgres is the hosted engine. Callers see the store interfaces below, not the engine. Version 2's `world.json`, rewritten under a process-wide lock, is not this design. A JSON file under a lock can still implement a store in a test. It is not what the build uses.

Async methods of every store do their work off the event loop. A blocking lock or a `sleep` inside an async call would stall every agent sharing that loop. Version 2 retried a file lock with `time.sleep` on the UI thread, and the interface froze for the retry. A transient busy error that outlasts the busy timeout is retried a few times with a short backoff on the worker. When the retries are spent, the call fails, and the screen stays responsive.

## Story store

The story store is the adapter the commit codes against. It has six operations and no knowledge of the rules inside a story.

A story is a story row and a row per record. The story row holds the story id, the owner id, the schema version, the framing fields, and `unit_ids`. The story id is assigned by the store and may be opaque. A record row holds the story id, the record id, the kind, the record's fields, and the ids the record names: for an Assertion its `entity_ids`, `event_ids`, and `arc_ids`; for an Event its `entity_ids`; for an Arc its `event_ids`; for a Narrative Unit its `child_ids` and `subject_ids`; for a Property its `entity_id` and `caused_by`; and for any record the Event ids its spans use as time points. The Story Bible layer computes that list from the record's fields when it writes the row. The store does not read the fields to find it. Every row, the story row included, has a revision: an integer that starts at 1 and increases by one each time a save writes or guards that row. There is no story-wide revision. The whole story is the document in [story-bible.md](../story-bible.md); the rows are how the store holds it.

| Operation | Role |
| --- | --- |
| `create(user_id)` | A new empty story owned by the acting user. The story row is at revision 1. |
| `load(user_id, story_id)` | Every row of a story the acting user owns, each with its revision, read in one transaction so the snapshot is consistent. |
| `save(user_id, story_id, changeset, source)` | Apply a set of row operations, each guarded by a revision, as one transaction, and write the commit record in [Commit history](#commit-history) in that same transaction. Returns the new revisions and the commit id, or a conflict naming the rows that did not match and their current state. |
| `history(user_id, story_id)` | The story's commit records, newest first. It returns every record. Filters on the source fields below and a time range are planned with the turns. |
| `list(user_id)` | The acting user's stories. |
| `delete(user_id, story_id)` | Remove the story, its rows, and its commit records, for its owner. Removes that story's conversation rows and their threads. Call records keep their `story_id`; they are debug data, not story data. |

A changeset holds row operations of four kinds:

| Operation | Guard | Effect |
| --- | --- | --- |
| `create` | The row must not exist. | Inserts it at revision 1. |
| `update` | The row's revision equals the expected revision. | Replaces the fields and the named ids. Revision moves by one. |
| `delete` | The row's revision equals the expected revision. | Removes the row. |
| `guard` | The row's revision equals the expected revision. | Changes nothing in the row. Revision moves by one, so a concurrent write or guard on the same row conflicts. |

The save also checks the names. Inside the same transaction, every id a created or updated row names exists in this story, and no row outside the changeset still names a deleted row. A row that fails that check is a conflict, reported with the rows involved. The check is generic. The store does not know that an Assertion needs two participants or that a Narrative Unit has one parent. It knows that a row names another row, and it refuses to let two saves interleave into a dangling name. The Story Bible layer makes the same check first, against its snapshot, and produces the refusal with the legal ids. The store's check is the race guard behind it.

`save` is one transaction. Every guard is checked and every operation applied, or none is. A conflict on one row means nothing in the changeset landed. In SQLite the transaction is one writer at a time. In Postgres the save locks the rows it touches and the rows it names before it checks them, or runs at serializable isolation and treats a serialization failure as a busy error, so two saves on one story cannot both pass their checks against a state neither one leaves behind. For a JSON file in a test, the same guards run under a lock before one file replace.

Two saves that touch different rows do not conflict. Two saves that write, delete, or guard the same row are ordered by that row's revision, and the second sees a conflict instead of overwriting the first. Two saves that both create the same id are ordered the same way: the second one's `create` fails, which is how a slug collision between two parallel creates is caught. Two different stories never conflict.

The store keeps no earlier state of a row. A row holds its current state, and the commit history in [Commit history](#commit-history) records each change with its before and after. An evaluation run that needs the story before and after a workflow copies the document into its own record, because a copy is simpler than a reconstruction and survives a history cap; the evaluations doc owns that record.

## A commit

A commit is the Story Bible layer's algorithm, above the store. Every change to a story goes through it: a user's edit, a tool call, an agent's draft, an import, a revert.

1. `load` a snapshot of the story, every row with its revision.
2. Apply the writes to that copy, in order. A write is a create, an update, or a delete of one record, or a change to the framing fields or `unit_ids`. A later write in the set can see what an earlier one created, so several creates can refer to each other. That is the case version 2 broke. The commit mints the ids, so the caller cannot know them in advance: a create may carry a label the caller chose, a later write in the same set names that record as `@label` wherever an id goes, and the commit puts the minted id in its place before the check in step 3. A label that no earlier create in the set carries is a refusal. [application.md](application.md) gives the request shape.
3. Check the resulting document against the rules in [story-bible.md](../story-bible.md): an unknown id, a delete something still names, a Narrative Unit in two lists or inside itself, a blank primary text, a span cycle. A failure returns the refusal, with the legal ids for that kind of record. Nothing was written.
4. Build the changeset: a `create` for each record the writes made, an `update` or `delete` at the snapshot revision for each record they changed or removed, an `update` of the story row when the framing or `unit_ids` changed, and the guards below. `save` it with the source of the change, so the store writes the commit record in [Commit history](#commit-history). A conflict returns the rows that moved and their current state.

The changeset guards a record the writes did not change when a rule's answer depends on that record staying put:

- A write that puts a Narrative Unit into a `child_ids` list or into `unit_ids`, or takes it out, guards that unit and every unit below it in the snapshot. Two parallel writes that each give the same unit a parent then conflict instead of leaving it in two lists, and a write that would make a unit contain itself through a longer chain conflicts with the guard on the subtree instead of landing beside the write that closes the loop.
- A write that adds a span whose time point is an Event guards that Event and every Event the snapshot reaches from it by following time points. A cycle can only close if another write changes an Event on that chain, and that write then conflicts with this guard instead of both landing. Chains are short, so the guard set is small.
- A delete of an Entity carries a `delete` for each Property the snapshot shows it owning. A Property created on that Entity after the snapshot is a row that still names the Entity, and the store's name check turns the delete into a conflict.

Nothing else is guarded. Creating a Property on an Entity, naming an Entity in an Event, or naming an Event in an Arc does not guard the named record; the store's name check already keeps it from being deleted out from under the write. Five parallel creates of unrelated records touch five different rows and all land. Five parallel Properties on one Entity touch five different rows and all land.

Three outcomes: committed, refused, conflict. A refusal comes from the Story Bible layer, and the stored story never held the bad state. A conflict comes from the store, and means someone else committed first on a row this commit needed. The caller decides what to do with either. A tool returns a refusal to the model as a tool message with status `error`. After a conflict, a caller may reload and run the commit again from step 1. A write that updates or deletes a record whose fields changed since the first snapshot is not reapplied; the caller returns the current record and writes nothing. A create, a guard that only moved a revision, and an update or delete of a record whose fields are as they were are reapplied, and the re-check in step 3 can now refuse what the first check allowed. The agents doc bounds how many times a tool does this.

There is no live object beside the store. Version 2 kept one in-memory world, mutated it, and saved afterward, so a failed save left memory and disk disagreeing and the model's retry then duplicated the phantom change. Here the copy in step 2 is private to the commit and is discarded if the commit does not land.

The screen holds the user's edit until the commit succeeds. The stored story changes only at that commit. A failed commit, including a refusal, a conflict, and a busy error that ran out of retries, leaves the stored story as it was and leaves the edit on the screen so the user can retry or reload. An agent's commits during a run move only the rows they write, so a user's pending edit of another record is not disturbed by them. A pending edit conflicts when the record it edits, or a record it guards, moved. The screen then shows the current record beside the edit. The store does only the revision and name checks.

A user edit and an agent write use this same commit. Version 2 gave rollback to tool calls only.

### Tool calls on one story

Version 2 ran the tool calls of one model message at the same time, against one in-memory world. A later call in the batch could name a record an earlier call had not created yet, or could validate against a half-updated story. The mitigation serialized every tool call in the process. That was correct, and it gave up every other kind of parallelism.

The problem was the shared live object, not the parallelism. Here each write tool call is its own commit against a committed snapshot, and a revision belongs to a row rather than to the story, so a batch of tool calls can run at once without a gate:

- Independent writes in one batch. Each one's changeset touches its own rows. All of them land, in whatever order the store runs them. None saw a torn story, because each validated a consistent snapshot and the store checked the names inside each save.
- Two writes in one batch on the same record, or two creates that mint the same slug. The second one's `save` conflicts. The tool reloads and runs its commit again. An update of a record the sibling just changed is returned, not reapplied. A create whose slug is now taken mints the next one.
- A dependent batch, where call B names an id that call A creates. If B commits first, it is refused with the legal ids. The model sees A's result in the same tool round and issues B again. That costs a turn, only when the model batched dependent writes.

Independent reads of a story run together. Writes to two stories run together. A middleware that serializes every tool call in the process is not part of this design. Restricting the model's parallel tool calls is a cost choice, and the agents doc declines it. A batch runs, and a dependent call that loses the race is refused and issued again.

### A draft commit

A multi-step agent draft is the same commit with a longer-lived snapshot. The draft holds the writes until one commit. That changeset carries the snapshot revisions for every record the draft writes, and a `guard` for every record the draft read while planning, so the commit lands only if nothing it saw has moved. If anything has, the commit conflicts, returns the rows that moved, and writes nothing. The story is still the one the user has. The agents doc says the caller reports that conflict and does not reapply the draft onto the new state. The plot-draft commit in version 2 is the pattern. The process-wide story-bible claim it also required is not.

If the process dies before that commit, the draft is gone. The draft is in-process state; it is not in the conversation thread's checkpoints. The story stays at the last successful commit. Call records already written stay in the log. Resuming a workflow after a restart, and checkpointing a run that must survive the process, wait in [future-work.md](../future-work.md).

A busy flag in the UI can tell the user a run is in progress. It is not what keeps the story consistent. Version 2's in-memory job claims died on restart and were not a transaction. They are not ported.

## Commit history

Every save writes one commit record, in the same transaction as the rows it changes. The record is what the writer reads to see what a turn did, and it is what a revert is built from. The changeset the commit already built is the record; the store keeps it instead of discarding it.

| Field | Role |
| --- | --- |
| `commit_id` | Key. Assigned by the store. |
| `story_id`, `user_id` | The story and the acting user. |
| `committed_at` | When the save landed. |
| `source` | `user`, `tool`, `import`, `draft`, `revert`, or `eval`. |
| `thread_id`, `run_id`, `tool_call_id` | For `tool` and `draft`: the conversation, the agent run that is the turn, and the id the model gave the tool call, which the logging doc's `tool_call` record also carries. Empty for the others. For `eval`, the evaluation run's `workflow_run_id` is in `run_id`. |
| `reverts` | For `revert`: the commit ids this one undid. Empty otherwise. |
| `changes` | One entry per record the save created, updated, or deleted, in the order the writes were applied. |

A change entry has the record id, the kind, the operation, the fields before, and the fields after. A create has no before. A delete has no after. An update has both. A change to the story row's framing or `unit_ids` is an entry on the story row. Guards are not changes and are not recorded. A conflict or a refusal writes no commit record, because nothing landed.

The before-image is taken from the row the save read to check its revision, inside the transaction, so it is the state the write replaced and not a later one. That read already happens. Keeping what it returned is the whole cost.

A turn's changes are the `tool` commits with that `thread_id` and `run_id`. The write tool passes those from the agent context and from its own tool-call id, as the agents doc says. The call log records what the model asked and what the tool answered; this record is what the story did. The two are joined by `tool_call_id`.

### Revert

A revert is a commit. It takes one commit record, or every commit of one turn, and applies the inverse of each change in reverse order: a created record is deleted, a deleted record is created again with its original id and its before-image, an updated record gets its before-image back. The inverse is applied to a copy of the loaded document and checked by the same rules as any commit, and the changeset is the one any commit saves, guarded by the current revisions of the records it touches. A create write is not used, because that write mints a new id. When the revert names several commits, they are undone newest first, each against the document the previous inverse left. The result is a new commit with source `revert` naming the commits it undid. The reverted commits stay in the history. Nothing is erased. Reverting a revert reapplies the original commit.

A commit record keeps fields, not revisions. "Edited since" means the record's current fields differ from that commit's after-image. The same comparison applies to the story row's framing and `unit_ids`. A record the revert would delete or update must still hold that after-image. When it does not, the revert is a conflict and returns the record's current fields, or marks the record gone when it is no longer there. A record the revert would recreate, but whose id exists again, is a conflict.

The same rules apply. If the writer has since built on a record the revert would delete, the delete is refused with the referring records. A turn-level revert is one commit, so it lands whole or not at all. The screen shows what is in the way, and the writer edits that or reverts a smaller set. The revert does not force the story back.

A recreated record keeps the id it had. The identity rules in [story-bible.md](../story-bible.md) mint an id when a record is first created. A revert is not a first creation, and an import already keeps the ids from its file. The revert is the only path besides import that creates a record with an id it did not mint.

The agent does not revert. A revert is an action the writer takes on the history view. The agents doc keeps it off the toolset.

### What the history is not

The history is edit history: who changed the story and what they changed. It is not story time, and it is not a second copy of the current state. The current state is the record rows. The in-force view in [story-bible.md](../story-bible.md) is over those rows, not over the history.

Commit records are story data. They are deleted with the story. They are not in the story export; the export is the story, not how it got there, and an imported story starts its history with the import commit. There is no retention cap on them. A story's history grows by one small row per commit, and a story that has thousands of commits is a story that has been worked on. If a cap is ever needed, it is a cap on the oldest records, and a revert of a commit whose record is gone is simply unavailable.

An evaluation run still copies `bible_before` and `bible_after` into its own record. Reconstructing a document from the history is possible and is not what the evaluations doc relies on. The copies are simpler and they survive a history cap.

## Config store

The config store implements the operations in [model-configuration.md](model-configuration.md): list, get, save, delete, select, resolve, export, and import. One document per user, addressed by user id. The document shape, the four roles, and the import rules stay in that doc, above the store.

Locally the document is a row in `app.sqlite`. On Railway it is a row in Postgres. Each operation that changes the document reads it, changes it, and writes it inside one transaction on that row, so two operations from two tabs do not lose one another's change. The caller does not pass a revision. The export file is still the JSON document that doc describes. The export is a serialization, not a copy of the database.

## Secrets

The user provides their own OpenRouter API key. The secrets store is `set`, `get`, and `delete` for the acting user's key. The model binding in [model-configuration.md](model-configuration.md) reads the key through `get` when it builds a chat model. Nothing else reads it.

The key is not a field on the config document. It is not written into a story export, a config export, or a call record. Locally it is a row in `data/secrets.sqlite`, in plain text; the local install is the user's own machine, and the separate file keeps the key out of a copied `app.sqlite`. On Railway it is a row in its own table, encrypted by the application with a key from the environment before it is written, so a database dump does not contain usable keys. Platform encryption at rest protects the disk, not a dump. No export query reads that table. The key reaches this store through the API's `set` endpoint; the screen that collects it is planned, and [build-sequence.md](../build-sequence.md) places it.

## Conversations

A conversation is a LangGraph thread. The chat agent from `create_agent` is compiled with a checkpointer, and the conversation's id is the `thread_id` it is invoked with. The transcript the workspace shows is that thread's state. There is no second message table. The logging doc's `thread_id` is this id.

The app keeps a conversation row in `app.sqlite`: the conversation id, the owner, the story, and a created time. The checkpointer's tables carry no user or story, so that row is the scope. A request resolves a conversation through its row, and the owner check happens there, before the agent is invoked with that `thread_id`. A thread has one invoke in flight. A second prompt on that conversation waits until the run has ended, as the agents doc says. A turn whose process died is reported as interrupted under the heartbeat rule below and no longer counts as running; the application doc states that. Story edits during the run are commits, and they do not start a second invoke. The store allows more than one conversation per story. The agent runs on the conversation it was given. The workspace shows the story's latest conversation and lets the writer start a new one, as the agents doc says.

Locally the checkpointer is the SQLite checkpointer on `data/checkpoints.sqlite`. On Railway it is the Postgres checkpointer. Each is its async form for the streaming chat path and its sync form for a sync caller. The sync saver does not implement the async methods, so the chat loop, which streams, needs the async one. This is the same rule as the middleware hooks. The library's setup creates its tables; the app does not define them.

Deleting a conversation deletes its row and its thread. Deleting a story deletes its conversations. A conversation is not a Story Bible record. The story export does not include it. Version 2 kept chat in a side file and left it out of the ZIP. The side file had no owner and no story. The exclusion from the export stays.

This checkpointer is conversation memory. It gives the chat agent its history between turns. Using it to resume a workflow after a process restart is a separate decision that waits in [future-work.md](../future-work.md), and the draft commit above does not depend on it.

## Call-log store

The call-log store implements the interface in [llm-debug-logging.md](llm-debug-logging.md): `start`, `finish`, `get`, and `list`, each in sync and async form. `start` inserts a row keyed by `call_id`. `finish` updates that row. A `finish` for an unknown `call_id` still inserts the outcome. The caller never loads the log to write one record. Two writes of two keys both land, and a row is never torn.

Every read and every list is scoped by `user_id`.

### Instances

A process generates an `instance_id` when it starts and keeps it until it exits. It writes a heartbeat row in the call-log store at start and about every 30 seconds, with that id, the start time, and the time of the heartbeat. The rows live with the call log because only the API reads them, to derive `interrupted` on a call, a turn, or a run, and they are the most disposable data the app has.

The rule, which the API applies and the logging doc defers to: a `running` record is interrupted when its `instance_id` has no heartbeat in the last 90 seconds, three missed beats, or has no heartbeat row at all. A crash never writes a stop row, so staleness is the rule, and a replica that scaled down looks the same as one that died. A local run is one process and uses the same heartbeat, so the view has one rule. Heartbeat rows older than a day are deleted by the same routine that handles retention.

### Recovery

Call logs are disposable. Story data is not, which is why the log has its own file.

A busy error is not corruption. `database is locked` is retried as [The data directory](#the-data-directory) says, and never triggers the recovery below. Otherwise a healthy log would be renamed under a concurrent writer.

If `call_log.sqlite` cannot be opened, or is not a valid database, the store renames it to `call_log.sqlite.unreadable-<utc timestamp>`, creates a new empty log, and continues. A row that cannot be read is skipped. The failure is logged. It is not raised to the middleware, and it does not stick: the next call uses the new log. `app.sqlite`, `checkpoints.sqlite`, and `secrets.sqlite` are not renamed by this recovery. If any of those cannot be opened, the app reports that and does not discard them.

On Railway a failed read of the log does not latch the store into a failed state. The middleware already swallows a store error. The next call tries again.

### Retention

A record an evaluation run cites is kept. The evaluation store records the cited model-call `call_id`s. One deletion routine removes call records, whether the retention routine or the user's "clear log" runs it, and it excludes every id the evaluation store cites. It also excludes a tool record whose `parent_call_id` is one of those ids. The log store itself has no delete that bypasses that routine. The evaluations doc says what a run cites. It does not choose a second retention rule.

The local log has no count cap and no age cap. Version 2 kept the newest 200, which would have dropped records a later evaluation still named. The user can clear the log, which removes that user's uncited records.

On Railway, the routine may delete uncited records older than 90 days. Cited records stay while the run that cites them stays. A user clearing the log deletes that user's uncited records only.

## Export and import

A story export is a serialization of that story's document, for a story the acting user owns. It includes the schema version. It does not include row revisions, the commit history, other stories, configs, the API key, call logs, or conversations.

There is no prose yet, so the export is one JSON document. When prose exists, the export can be a zip with that document and the prose blobs. Version 2's zip was `world.json` plus scene files because the prose lived beside the world. The extra members, when they exist, are the blobs. The exclusion list does not change.

Secrets stay out. Version 2's export also left out model profiles, and that stays: configs have their own export, in the model-configuration doc.

Import checks the schema version and fails with a clear error when it does not match. Import does not migrate an older export. A successful import is a `create` followed by one commit of the file's contents, checked by the same rules as any commit, so a file with a duplicate id or a dangling reference is refused before anything is written. Record ids from the file are kept. The new story is owned by the acting user and has a new story id. Import does not replace an existing story. Version 2 had one world, so import replaced it.

## What stays open

Workflows that must survive a process restart wait in [future-work.md](../future-work.md). Until one is needed, a run lives in the process. The story does not hold a half-applied draft.

These stores are called from the Python API in [application.md](application.md), and from nothing else; the frontend never opens one. How a hosted request authenticates is chosen when hosting is built. It does not change the ownership model.