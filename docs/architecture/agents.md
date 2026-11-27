# Agents

This is how an agent changes the Story Bible, and what the first workflow does. That workflow is a chat agent: the user describes a story, and the agent writes the arcs and the records those arcs need. The Story Bible doc is the authority for the records and the save rules. The persistence doc is the authority for the commit. The model-configuration doc owns the `chat` node and the prefix. The prompt-assembly doc owns which layer a piece of context belongs in. This doc owns the tools, the arc agent's job, and the choices that are still open.

## What an agent may change

An agent reads and writes the Story Bible only through tools. It does not receive a live story object, and it does not edit the stored document by any other path. A user edit uses the same commit the tools use. The two paths differ in who calls the commit, not in the rules the commit checks.

The story and the user come from the agent context the logging doc passes on the invoke. The tool reads them from `runtime.context`. They are not arguments the model supplies. A tool argument that named a story would let the model write a story this conversation does not belong to.

A write tool builds one commit, as the persistence doc defines it: load a snapshot, apply that tool's writes, check the Story Bible rules, save a changeset guarded by the revisions of the records it touches. A create does not take an id from the model. The commit mints the id from the primary text, under the identity rules in [story-bible.md](../story-bible.md), and the tool result returns that id. A retry after a conflict mints against the story it reloaded, so two creates cannot land on one id. An update, a delete, or a reference uses an id a tool already returned.

A Story Bible refusal is a tool result with status `error`. An unknown id, a delete of a record something else still names, leaked markup, and a failed rule check are that result. The message names the field or the record. An unknown id includes the ids that exist for that kind. A delete something still names includes the referring records. Nothing was stored. The run continues. The model reads the error and issues a corrected call. The tool does not retry the refused write. Tools are local and deterministic, so a blind retry would repeat the same refusal.

A string returned as an ordinary result is a success, and the model will treat the write as stored. A refusal uses the error status.

An unexpected exception leaves the tool and stops the run. `create_agent` does that for an exception the tool raises. A schema mismatch is already a tool message, before the tool body runs. These tools do not use retry middleware. The conflict retry below is the tool rerunning its own commit a bounded number of times. It is separate from that middleware.

On a conflict, the tool reloads and runs the same commit again, as the persistence doc says. A revision belongs to a record, not to the story, so a sibling that wrote a different record causes no conflict at all, and the conflicts that remain are on the record this write is about: a create whose slug a sibling just took, a guard that moved, or an update of a record someone else changed. A create reapplies and mints the next slug. A guard that only moved a revision reapplies. If the writer, or another call, changed the fields of a record this write updates or deletes, the tool returns the error and the record now stored, and does not reapply. The writer's edit stands. If a reapply breaks a Story Bible rule, the refusal is the tool result. The tool makes a bounded number of attempts, then returns the conflict as an error result with the current records. A conflict that survives them means something is writing the same record repeatedly, and the model should read before it writes again.

A write tool passes the source of its commit: `tool`, the conversation's `thread_id` and the agent `run_id` from `runtime.execution_info`, and its own tool-call id from `runtime.tool_call_id`, which the logging doc's tool record also carries. The `run_id` is the one the caller put in the invoke config, as the logging doc says. The persistence doc writes those on the commit record, so the history view can show what one turn changed and the writer can revert that turn. The agent has no revert tool. Undoing is the writer's action on the history, and a tool that could undo would let one turn erase another.

A write tool rejects markup that leaked into a string argument. Version 2 saved field values that still contained the tool-call XML, including a `<parameter>` tag or the tag of a sibling argument concatenated into an earlier string. The check is on the tool, before the commit. A string argument is refused when it contains a tool-call tag. The refusal names the field. The value is not stored. A writer's edit is not checked this way. The writer can type those characters on purpose.

A batch of tool calls from one message may run at the same time. The persistence doc already makes that safe: each call commits its own snapshot, revisions are per record so unrelated writes never conflict, a conflict on the same record reapplies only when that record's fields are unchanged, and a call that names an id a sibling has not created yet is refused with the legal ids. The model sees the sibling's result in the same round and issues the dependent call again. That costs a turn, and only for a dependent batch. This doc keeps that behavior. There is no middleware that serializes every tool call in the process, and there is no middleware that keeps only the first write in a message. Version 2 added both after concurrent calls raced on one in-memory world. The race was the shared object. The gates are not ported.

Read tools do not write. They return stored records, or the in-force view when the question is what holds at a time. A read does not paraphrase a record into a new claim.

## The arc-planning chat

The first workflow is the chat agent. It is one `create_agent` agent, built by the shared agent builder, on the registry node `chat`. Its default role is `orchestration`. The conversation it runs in is the LangGraph thread from the persistence doc. The logging context is `workflow` `chat`, `node_id` `chat`, and that thread's id. `workflow_run_id` stays empty, because the agent is the run.

There is no nested plot agent. Version 2 took event writes off the chat agent and ran them inside `plan_plot`, a tool-loop sub-agent that drafted in a sandbox, interpreted intimacy on each write, and blocked the chat turn until it finished. The blocking call is the failure in version 2's known issues. This workflow does not have that call. The chat agent writes the records itself, and the turn streams while it does.

The planning unit is the story the conversation belongs to. The user describes the story they want. The agent writes a small set of arcs and the records those arcs need. Later prompts revise that same story. The user can edit the bible by hand between prompts, and the next turn reads whatever the commits have stored. A beat, a scene, a sequence, an act, or a graph window is not a mode of this workflow. When a story is large, the user says what to change, and the agent reads the records that request needs.

One turn does this:

1. The user sends a description, or a revision of what is already stored.
2. The agent reads what it needs and writes framing, Entities, Properties, Assertions, Events, and Arcs.
3. Each write commits as it succeeds. The story on disk changes at that commit. The writer can inspect it and edit it during the run. When the turn ends, the history shows every commit it made, and the writer can revert the turn or any one commit in it. Another prompt on this conversation waits until the run has ended. A turn whose process died is not running: the application doc reports it as interrupted under the heartbeat rule, and it does not block the next prompt.

Prose is out. The agent does not create Narrative Units, and it does not write scene text. It does not touch `unit_ids` or any unit's `child_ids`. The writer may build units by hand once editing is built; the agent leaves whatever is there alone until a prose workflow exists.

Plot is the Events and the Arcs. The agent does not decide what happens by simulating a character's reaction, and it does not run an interpretation step that derives a rank or a signal. Version 2's plot loop was constrained by that chain: a desired later beat had to be justified by replaying character state forward. Here a later Event is just an Event the agent writes. Coherence is the writer's judgment and the agent's reading of the records. The tools check references. They do not check whether a beat is dramatically plausible, and they do not check whether two statements contradict. Both save, as the Story Bible doc says.

A place is an Entity. The agent creates and edits it with the same tools as any other Entity. Routes, travel times, and whereabouts stay in the Story Space project. This agent does not call a location agent.

### The base prompt

The node's base prompt is the system prompt passed to `create_agent`. The user's prefix is a different string. The prefix middleware applies it. The prompt builder does not read the prefix.

The base prompt carries these instructions. The wording is the prompt builder's. The obligations are these:

- The job is to turn the user's description, and later prompts, into Story Bible records for this story.
- Write the story framing and the Entities, Properties, Assertions, Events, and Arcs the request needs. Do not write prose or Narrative Units.
- Plan the plot as Events and Arcs. A closer look at a character or a place is a read. It is not a simulation that decides the plot.
- Use the tools. Do not treat a record as stored until an ordinary tool result says so. A result with status `error` is a refusal. Correct that call. Do not repeat the refused write. Use the ids the tools return.
- When the world changes, leave the old Property or Assertion in place, adjust its spans, and create a new record. Do not rewrite the old sentence so that it means something else.
- Keep an agent-written statement concise and narrow. Do not "correct" wording the writer saved unless the writer asks.
- Missing information stays unspecified. Do not invent a fact to fill a gap the user did not ask for.
- Do not create an Event for a detail nothing depends on. A large development is several Events, not one.
- Locations are Entities. Do not invent routes or travel times.

### Tools

The toolset is the Story Bible, plus the framing fields on the story. Names can vary. The actions are these.

| Action | Commit | What the model supplies | What the tool returns |
| --- | --- | --- | --- |
| Read framing, or one record, or a list of one kind | no | An id, when the read is of one record | The stored fields, or the ids and primary text of the list |
| Read what is in force at a story time | no | The time, and the Entities or Events in question | The in-force view from the Story Bible doc |
| Set framing fields | yes | The fields to change: `title`, `description`, `premise`, `tone`, `themes`, `writing_style` | The fields now stored |
| Create a record | yes | The fields of that kind. The kind is which tool, or a discriminator on one tool | The minted id and the stored record |
| Update a record | yes | The id and the fields of that kind that are changing | The stored record |
| Delete a record | yes | The id | The refusal and the referring records, when something still names it |

Each action the model fills has a schema of that record's fields. A create takes the fields of an Entity, a Property, an Assertion, an Event, or an Arc, as one tool per kind or as one tool with a discriminated kind. An update takes the id and the fields of that kind that are changing. A shape the schema rejects fails before the commit. A shape the schema accepts and the Story Bible refuses is the error result above. Tool names can vary.

A create of an Entity, a Property, an Assertion, an Event, or an Arc is in the set. A Narrative Unit is not. `writing_style` may be set when the user stated it. The field does not start a prose workflow.

### What the user has open

A note about the page or record the user currently has open is a content block on the user message for that turn. The thread stores it, so a later turn can see what the user was pointing at. The next turn carries its own note when the user has moved. The note is not part of the system prompt. The assistant's visible reply is still only assistant text, as the prompt-assembly doc says.

## Cancellation

The user can stop an arc run while it is going. The stop takes effect at the next superstep boundary. A model call or a tool batch already running finishes. Version 2 stored a `cancel_requested` flag on the job and never consulted it. This check is the requirement. A flag that nothing reads is not a cancel.

If the stop is already set when a model call finishes and that call requested tools, those tools do not run. If a tool batch is already running, its commits stay, and the turn ends before the next model call.

A stop ends the turn. The caller closes the thread before another prompt is accepted. Every tool call the model requested has a tool result, and each call that did not run says the turn was cancelled. The user can then send another prompt. The cancelled run is not resumed. Resuming it would run the tools the stop held back.

The conversation accepts one run at a time. The writer can edit the story while the agent is running. Those edits are ordinary commits. A tool whose records are unchanged reapplies, as above. The chat input for this conversation waits until the run has ended, or until the application doc's heartbeat rule reports the turn as interrupted. The workspace is not locked for the duration of the run, and the chat turn is not held silent until a nested planner finishes. There is no nested planner.

The chat invoke sets `recursion_limit`. The framework default is 10,007 super-steps. This invoke sets 80: one super-step for the model call and one for the tool batch, about forty rounds. Past the limit the turn ends the same way a stop ends. Commits that landed stay, and the caller closes any tool call that has no result.

A busy indicator may say that a run is in progress. It is not what keeps the story consistent.

## A draft, when a batch must land together

The ordinary path is one commit per tool call, and that is the path the arc chat uses. A draft is the other commit in the persistence doc: the writes accumulate on a private snapshot, and one commit at the end is guarded by the revisions of every record the draft wrote or read.

The first workflow does not open a draft. The writer sees each successful tool call in the story, and can edit between prompts. The draft stays available for a later run whose writes must land together or not at all. Version 2's plot sub-agent used that shape. Its sandbox, its intimacy feedback, its one-write-per-message gate, and the process-wide claim it held are not part of the shape this doc keeps.

If any record the draft wrote or read has moved since the draft started, the commit conflicts and writes nothing. The caller tells the user the story moved. It does not reapply the whole draft onto the new state. The user can ask for the work again against the story as it is. If the process dies before the commit, the draft is gone and the story stays at the last successful commit.

No run waits for the writer to approve a commit, including a run that uses this draft. The writer's review is after the fact: the history view lists what the turn changed, record by record with the before and after, and the writer can revert one commit or the whole turn. That is the workflow this product aims at, and it is settled as item 23 in [open-questions.md](../open-questions.md). A gate in front of the commit was considered and set aside: it would make every agent turn block on the writer, when the history already gives the writer the same control without stopping the work. Approval on each write tool was set aside for the same reason, and it would have changed the direct-write path this workflow uses. The draft is a way to make a batch land together. It is not a way to make the writer wait.

## A fixed workflow, when the product needs a step order

Some later work needs an order the model must not skip. That workflow is a LangGraph graph. The edges fix the step order. Each node that calls a model is an agent from the shared builder, with its own registry entry and its own base prompt. The graph is an entry point of its own. The chat agent does not carry it as a tool it can reorder.

The arc chat is not that graph. One tool loop is the right shape, because the user is in the loop and the next prompt is the revision. The prose workflow is the first place a fixed order is expected. The build sequence holds the salvage for it: enforced steps, a model config per node, continuity from neighboring units, and saving each finished step. This doc does not design it.

Version 2's scene-writing graph and its intimacy graph are not ported. The intimacy workflow depended on replay and signals, which the Story Bible dropped. A belief, if a story needs one, is a Property or an Assertion written with the tools above.

## Later, and not this workflow

Exploring several candidate arc directions, and asking what a character would think, wait until this workflow exists. They are not tools on the arc chat, and the arc chat does not call them.

When exploration is added, a candidate is not a Story Bible record. It stays off to the side until the writer, or an explicit step the writer asked for, adopts it. Adopting it writes records through the same tools and the same commit. Nothing in the exploration becomes canon by being generated.

When a character query is added, it is a read. The input is a character and a story point. The answer uses only what that character could know there, from stored records, and it is not written into the bible. Persisting an answer would be a separate decision. The query does not decide the plot. The open choices for both additions, including how many candidates, how they are ranked, and the exact knowledge boundary, stay in [open-questions.md](../open-questions.md).

How many conversations the workspace lists stays open with the UI. The store already allows more than one conversation per story. The agent runs on the conversation it was given. The turn stream carries the assistant text and the tool calls and results as typed events, item 40 in [open-questions.md](../open-questions.md); the reply the frontend renders is the assistant text, and whether it also shows the calls is a rendering choice there.

## What stays open

[open-questions.md](../open-questions.md) holds the choices this doc does not close: how many conversations the workspace shows, and the shape of later exploration and character queries. Review before a commit is settled there as item 23: there is none, and the history view with its revert is the writer's review.
