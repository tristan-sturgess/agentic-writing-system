# Deployment and concurrency

The system runs locally first. The hosted target is Railway, for more than one user. The Linear storage issue (DEF-50) asks for a local path and a hosted path using Postgres and object storage. It does not name a cloud vendor. There is no Google Cloud requirement in the version 3 project text. Railway is the choice from the 2026-11-02 briefing.

The concurrency design is not optional background work. Version 2's worst failures were parallel tool calls and overlapping updates to the Story Bible. That design is part of slice 1, before an agent exists.

## What went wrong in version 2

Version 2 stored one `world.json` behind a process-wide lock and kept one in-memory `World` as the source of truth. The lock stopped two saves from corrupting the file. It did not give concurrent tool calls a consistent story.

Documented in [v2/architecture.md](v2/architecture.md) and [v2/known_issues.md](v2/known_issues.md):

- A single model message could emit several tool calls. The tool node ran them concurrently. A later call in that batch could reference an entity an earlier call had not created yet, or could validate against a timeline that was only partly updated.
- The mitigation was `SerializeToolCallsMiddleware`, which forced the batch to run one call at a time, in emission order. Correct, and it gave up parallelism.
- Agent writes used `world_transaction()`: hold the lock across mutate and save, and roll the in-memory change back if the save failed. UI form edits mutated bound objects first and then saved, so a failed save could leave memory and disk apart.
- The plot sub-agent forked a `PlotDraft` copy, edited the copy, and committed in one transaction, refusing the commit if the live events had changed since the fork. That is the pattern worth keeping.
- `JobManager` claims (`scene:{id}`, `chat`, `story_bible`) were in-memory and died on restart. They kept the UI and a running job from editing the same resource. They were not a multi-process design.
- Save retries could sleep on the UI thread when Windows briefly locked the file.

Those mechanisms were local and single-user. They do not carry over to Railway as code. The problems they were solving do.

## Write rules for version 3

Slice 1 should implement these properties. The storage engine can still be local files.

1. **A story is the isolation boundary.** Every record belongs to one story. A story has an owner. Locally there is one owner. The schema does not assume a single global world.
2. **A write is a transaction on one story.** A tool call, a user edit, or a draft commit either lands completely or leaves the story unchanged. Callers do not mutate a live object and save afterward.
3. **Read your own writes inside a transaction.** Several creates in one transaction can refer to each other. That is the case version 2 broke when tool calls ran side by side against the live world.
4. **Parallelism is allowed across independent work, and forbidden across a dirty read of the same story.** Two stories can be updated at once. Two transactions on one story are ordered. A batch of tool calls that build on each other runs inside one transaction, or as separate transactions that observe the committed result of the previous call.
5. **A long agent draft commits with a precondition.** The plot-draft approach still fits: edit a copy or a pending changeset, then commit only if the story revision is the one the draft started from. If the user edited in the meantime, the commit fails with the current revision and the agent or the user decides what to do. Silent overwrite is the failure mode to avoid.
6. **User edits use the same transaction path as agent edits.** The version 2 split, where only tools were transactional, should not come back.
7. **Claims are an extra guard for in-flight workflows, not the source of consistency.** A running arc-planning job can mark the story busy in the UI. Correctness still comes from the transaction and the revision check, including after a process restart.

Global serialization of every tool call is the version 2 escape hatch. Version 3 can run independent reads in parallel, and independent stories in parallel. Dependent writes on one story share a transaction.

## Local and hosted storage

DEF-50's open split still applies:

| Kind of data | Likely home | Why |
| --- | --- | --- |
| Story Bible records, revisions, users, eval scores | Structured store. Postgres on Railway when hosted. A local embedded store or files behind the same interface while developing. | Queried, linked, and updated transactionally. |
| Prose bodies, prompt logs, eval artifacts | Object storage or files. Railway buckets are the likely hosted form. | Larger blobs, written as a whole, referenced by id from the structured store. |
| Secrets and model-provider keys | Environment configuration, never inside an exported story. | Same rule as version 2. |

The interface that slice 1 codes against is "load and save a story revision transactionally." Swapping the local implementation for Postgres is the migration, not a redesign of the agents. Exact file formats, and which fields are blobs, can wait until prose and eval artifacts exist. The story id, owner id, and revision need to exist in slice 1.

Multi-tenancy at the data layer means: a request acts as one user, and every read and write is scoped to stories that user can access. The first local build can authenticate as a single implicit user. It should still pass that user into the storage API so a second user is an authorization check, not a schema change.

## Railway, when we get there

Not part of slices 1–4. The deployment shape to aim at:

- The app runs as a Railway service.
- Postgres holds the structured story data.
- Object storage holds blobs once we have them.
- Long-running agent work cannot assume one uninterrupted process. DEF-51 (checkpoint, resume, cancel) becomes real at that point. Until then, local in-process runs are acceptable if a failed run leaves the story at the last successful transaction rather than half-applied.

No Railway project needs to be created for the documentation review.

## Durability of workflows

Short chat turns and the first arc-planning runs can live in the process. Their durable artifact is the committed Story Bible, plus the call log. If the process dies mid-run, the story stays at the last commit and the run can be started again.

Workflows that must survive a restart, or that fan out for many minutes, need a real checkpoint story. That decision stays with DEF-51 and is not required to start slice 1.
