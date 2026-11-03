# Creative Writing System

This repository is the version 3 build. Nothing is implemented yet. The documentation work below turns the current drafts and source snapshots into the project's own docs: concept, Story Bible, architecture, and build path.

This file is the plan. A later session should be able to carry out one step from this page alone. Do one step per session. When a step is accepted, update its status here before starting the next one.

## How the folder is organized right now

| Location | Role |
| --- | --- |
| This file | The plan, the accepted document list, and the status of each step. |
| [vision.md](vision.md) | The concept doc. |
| [story-bible.md](story-bible.md) | The Story Bible model. |
| Other drafts in `docs/*.md` | Working notes from the first pass. A later step rewrites or replaces each one. |
| [v2/](v2/SOURCE.md) | Frozen copy of the version 2 docs, README, and `AGENTS.md`, from `E:\dev\writing-agent-v2` at commit `f158920` (2026-08-27), repository https://github.com/tristan-sturgess/creative-writing-assistant. |
| [v3-concept/](v3-concept/README.md) | Frozen copy of the Linear project [Creative Writing System V3](https://linear.app/tristansturgess/project/creative-writing-system-v3-f6bf311c12a2), its issues, and Story Bible Data Model Draft 2, plus the related Story Space & Timeline project. Retrieved 2026-11-02. |

Keep both snapshot folders until the final step. They are the checklist of material that must be kept, adapted, or explicitly dropped. Git history also has them, in the initial docs commit.

## Decisions already in force

These come from the 2026-11-02 briefing. Later documents follow them. The document list was accepted in Step 1. Later steps follow that list and these decisions.

1. **This repository is the build.** The Linear project text describes itself as architecture-only, with implementation as a later project. Here, design questions stay visible and implementation follows these docs.
2. **Build order.** Story Bible data model, then a small set of editing and visualization tools, then a chat agent that writes story arcs into the model, then evaluations of arcs and other generated structure, then the prose workflow and prose evaluations. Prose stays out of the earlier slices.
3. **Hosted target is Railway**, with multi-tenancy in the data model, after a local-first implementation. The Linear storage issue names Postgres and object storage. It does not name Railway, and it does not name Google Cloud.
4. **NiceGUI is not the starting UI.** Version 2's interface got in the way of the visualizations this version needs. Whether the UI is React is still open.
5. **Story Space & Timeline stays related reference** for the first document set. Location entities can exist in the Story Bible. The location agent, routes, and time scrubber stay in that separate Linear project until a later decision pulls them in.
6. **Concurrent Story Bible updates are a prerequisite design**, taken from version 2's parallel tool-call failures, and they are specified before agent implementation.

The product is a creative writing system for fiction. The Story Bible is the shared object. The user can inspect and directly edit it. Agents are meant to do most of the work, with revision loops. Measuring whether a prompt or workflow change actually helped is a requirement, not a follow-up. Primary things to measure are story arcs and, later, prose. Characters, other generated entities, and the bible as a whole are also in scope.

## How to write one document

Write each finished document fresh, in version 3 terms. Mine version 2 for mechanisms. Leave version 2's story model, scene workflow, and intimacy simulation out of a document unless that document's scope says to address them.

For the step in front of you:

1. Read this file's decisions, the step's scope, and the sources it names. Also read [open-questions.md](open-questions.md) and [v2-import-inventory.md](v2-import-inventory.md) when the step touches architecture or the Story Bible.
2. Write the version 3 document so it answers the question named in the step. Point unresolved choices at [open-questions.md](open-questions.md) instead of inventing a decision.
3. At the bottom of the draft, add a short coverage note: each source section the step was responsible for, marked kept, adapted, or dropped, with a one-line reason. Remove that note after review if the user does not want it in the finished doc. Until then it is how the next session checks the work.
4. Update the source-coverage table in this file for every source row the step accounted for.
5. Stop for review. Set the step to **In review**. After the user accepts it, set it to **Done**.

Status vocabulary for the tables below: **Not started**, **In progress**, **In review**, **Done**.

## Document list

Accepted in Step 1. Paths are relative to `docs/`.

| Path | Question it answers |
| --- | --- |
| `vision.md` | What the system is for, how a writing session goes, and what this version is leaving until later. |
| `story-bible.md` | What the Story Bible stores, how the objects connect, and how user edits differ from agent edits. |
| `architecture.md` | How the pieces fit: boundaries, and which subsystem doc owns each concern. Written last, after the subsystem docs exist. |
| `architecture/model-configuration.md` | How the user selects OpenRouter models and how a system-prompt prefix is applied on every call that uses a config. |
| `architecture/prompt-assembly.md` | How a model's prompt is composed, and which kinds of context belong in the system prompt versus a specific message. |
| `architecture/llm-debug-logging.md` | How every model call is recorded, so the record is the prompt and response the model actually saw. |
| `architecture/persistence.md` | How a story is stored locally, how that maps to Railway and multiple users, and how concurrent updates land. |
| `architecture/agents.md` | How agents read and write the Story Bible, and what the arc-planning workflow is responsible for. |
| `architecture/evaluations.md` | What is scored, what an evaluation run stores, and how cost and latency sit on that same run. |
| `build-sequence.md` | The order to implement the system, and which docs each slice depends on. |
| `open-questions.md` | Decisions still deferred, each one naming the doc that will close it. |

LLM debug logging is its own file because the tap was easy to get wrong, and the evaluations doc only cites the records. Other version 2 material folds into the document named in the salvage list. The step that writes that document is responsible for it.

[vision.md](vision.md) is the concept doc from Step 2. [story-bible.md](story-bible.md) is the Story Bible model from Step 3. The remaining drafts this list still replaces or folds in are [architecture-direction.md](architecture-direction.md), [evaluations.md](evaluations.md), [deployment-and-concurrency.md](deployment-and-concurrency.md), and [build-sequence.md](build-sequence.md). [open-questions.md](open-questions.md) stays and is updated as decisions are deferred or settled. [v2-import-inventory.md](v2-import-inventory.md) is an input to the writing steps. It does not survive as its own finished doc.

### Version 2 salvage inside the existing documents

These are worth keeping and are not a new file. The named step writes them into the document that already owns the topic.

| Salvage | Home |
| --- | --- |
| Story-level framing (version 2's narrative style: premise, tone, themes, writing style). Draft 2 has no object for it. | Story Bible. Place it, or defer it in [open-questions.md](open-questions.md). |
| Readable ids that survive rename, including records created from the UI. Version 2 minted generic slugs for blank UI entities. | Story Bible. |
| What a dangling reference does. Version 2 warned and still saved. | Story Bible. Choose reject, warn, or allow. |
| The first pictures of the model: events in time, and arcs over those events. Version 2's timeline was a graph of typed edges. Story time is the span list on an Event. A cause or an order between Events is an Assertion. The widget stays open. | Story Bible, as what must be showable. |
| Whether a conversation is part of the story and its export. Version 2 kept chat in a side file and left it out of the ZIP. | Persistence. Already open; that doc closes or restates it. |
| User edits roll back with a failed save. Version 2 form bindings changed memory first, so a failed save diverged from disk. A save retry must not freeze the UI. | Persistence. |
| A failed write tool returns a recoverable error, including the legal ids, and is not blindly retried. Reject tool-call markup that leaked into a field value. | Agents. |
| An in-flight arc run can be cancelled, and it does not freeze the chat turn for the whole run. Version 2 stored a cancel flag and never wired it; `plan_plot` blocked the turn. | Agents. |
| Whether the user sees an arc draft before it commits. The commit stays one choke point either way. Multiple conversations, and showing tool calls in the chat, are the same kind of choice. | Agents, as open choices. |
| A stream consumer must not render every chunk as assistant text. That is how a system prompt leaked into the chat transcript. | Prompt assembly. |
| Prose, when that slice starts: create long text by intercepting a tagged stream, edit it with a targeted patch, treat exact match as the fast path, and return an error when a patch hits nothing or more than one place. Unbounded fuzzy search stalled large scenes. If the open document changes mid-stream, roll the partial write back. Reuse the enforced step order, per-node models, neighbor continuity, staleness when inputs change, and saving each finished step. Leave the stance and intimacy prompts behind. Readable HTML export waits until there is prose. | Build sequence, as deferred notes, not a design. |

### Documents considered and not added

Step 12 does not add these back.

| Candidate | Why it is not a document |
| --- | --- |
| A known-issues log | There is no code yet. The failures worth avoiding are in the salvage table. Start a defect log when there is something to track. |
| A future-work backlog | Relationship tracking and arcs are the Story Bible. Plot ideas that still apply are open choices on the agents doc. Scene-workflow ideas wait in the prose salvage. The rest is version 2 UI polish. |
| A version 2-style phased implementation plan | Those phases are finished history. The build sequence replaces the plan. |
| Contributor setup (`AGENTS.md`, agentic-development) | Write it when there is code to run and test. Do not copy the NiceGUI skill. |
| A prose or document-editing design | Prose is a later slice. The salvage table is enough until that slice is designed. |
| The intimacy workflow | Dropped with the replay model. Beliefs, if needed, are ordinary Story Bible statements. |
| Forms, layout, and the NiceGUI module map | That UI is not the starting point. Which objects are editable belongs to the Story Bible doc. |
| A workspace or UI specification | The framework is still open. Minimum views are already an open question. |
| A testing guide | The invariants live in the subsystem docs. A harness belongs with the contributor setup. |
| The import inventory, as a finished doc | It is an input to Steps 3–9 and is removed in Step 12. |
| Model-selection analysis as its own doc | The role rationale folds into model configuration. The July 2026 price table stays historical. |

## Status

| Step | Work | Status |
| --- | --- | --- |
| 1 | Finalize the document list | Done |
| 2 | Vision | Done |
| 3 | Story Bible | Done |
| 4 | Model configuration | Not started |
| 5 | Prompt assembly | Not started |
| 6 | LLM debug logging | Not started |
| 7 | Persistence, tenancy, and concurrency | Not started |
| 8 | Agents and arc planning | Not started |
| 9 | Evaluations and observability | Not started |
| 10 | Build sequence | Not started |
| 11 | Architecture overview | Not started |
| 12 | Final coverage review | Not started |

## Steps

### 1. Finalize the document list

Confirm the proposed list above before writing any finished document.

Read the proposed list, the decisions already in force, and the source-coverage table. Check the draft filenames and the version 2 doc titles in [v2/](v2/SOURCE.md) so a real topic is not left without a home.

Produce an updated list in this file. For each kept document, leave the question it answers specific enough that a later session knows when it is done. Reorder or renumber later steps if the list changes. Record any document that was considered and rejected, with a one-line reason, so Step 12 does not add it back.

Accepted. The eleven documents above are the set, including LLM debug logging as its own file. Salvage and rejected candidates are recorded under the list. Later steps write the salvage into the document named there.

### 2. Vision

Rewrite [vision.md](vision.md) as the concept doc.

Question: what is this system, who is it for, and what does a writing session look like from a description through revised arcs to, eventually, prose?

Read [vision.md](vision.md), [v3-concept/project.md](v3-concept/project.md), [v2/overview.md](v2/overview.md), and [v2/README.md](v2/README.md).

Keep the version 3 session shape: the user describes a story, agents populate and revise the Story Bible, the user edits by hand or with another prompt, prose comes after arcs. Keep user authority over content. State the build-order and deployment decisions in product language, with the detail left to the later docs.

Leave version 2's goal priority ("prefer the LangGraph learning path over the product") out. This version is the product. LangGraph can still be the agent layer. That choice belongs in the architecture docs, not as a goal that outranks the writing system.

Done when someone who has not seen the snapshots can tell what the system is and what the first versions will and will not do.

### 3. Story Bible

Rewrite [story-bible.md](story-bible.md) as the authoritative conceptual model.

Question: what does the Story Bible store, how do the objects connect, and how does time and user override work?

Read [story-bible.md](story-bible.md), [v3-concept/story-bible-data-model-draft-2.md](v3-concept/story-bible-data-model-draft-2.md), [v3-concept/issues/DEF-90.md](v3-concept/issues/DEF-90.md), [v3-concept/issues/DEF-53.md](v3-concept/issues/DEF-53.md), and [v2/story_bible_model.md](v2/story_bible_model.md). Use [v2/forms_and_data_models.md](v2/forms_and_data_models.md) only to see which edited fields existed, not as the schema to copy.

Start from Draft 2: Entities, Properties, Assertions, Events, Narrative Units, and Arcs. Keep the split between user edits and agent edits. Where version 2 had a mechanism worth a sentence of comparison (readable stable ids, chronology edges, scenes as presentation rather than world time), say what version 3 does instead. Intimacy replay, signals-as-effects, and derived ranks are out of the core model. Beliefs can be ordinary statements if the doc needs to say where they would go.

Also place the salvage assigned to this doc. Version 2 stored premise, tone, themes, and writing style as narrative-style fields, and Draft 2 has no object for that story-level framing. Ids stay readable and survive rename; a record created from the UI must not receive a meaningless generic slug. Say what a dangling reference does. Version 2 warned and still saved. Say what the early slices have to be able to show: events in time, and arcs over those events. Version 2 rendered that as a clickable graph with connect actions. Do not specify the widget. Review removed the Event-link record: a cause or an order between Events is an Assertion, and story time is the span list on an Event.

Leave Story Space's route and whereabouts rules out of this doc except for a short pointer that locations are Entities and that the physical-timeline subsystem is a separate project. Open modeling questions stay open and are listed in [open-questions.md](open-questions.md).

Done when slice 1 of the build could implement a schema from this doc without reading Draft 2 or the version 2 model.

Accepted. Review also settled these choices: there is no Event-link record; story time is a list of spans; an Arc is defined by its Events; a Narrative Unit stores ordered children and one set of subjects; the story orders the top-level units.

### 4. Model configuration

Add `architecture/model-configuration.md`.

Question: how does the user choose models, and how does a system-prompt prefix ride along with every call that uses that choice?

Read [v2/model_configuration.md](v2/model_configuration.md) and [v2/model_selection_analysis.md](v2/model_selection_analysis.md). Read the prefix section of [v2/architecture_prompt_assembly.md](v2/architecture_prompt_assembly.md) so this doc and Step 5 do not contradict each other. The prompt-assembly doc owns composition rules. This doc owns configs, selection, and the requirement that the prefix is applied.

Capture these rules from version 2. They took several iterations to get right:

- A model config is application data, separate from a story, and it is not part of a story export.
- The user can select an OpenRouter model in the UI, set sampling and reasoning options, and set a system-prompt prefix on that config.
- The prefix is bound to the resolved model client and applied on every call that uses the config, including streaming. The prefix is merged before the call is recorded, on both the one-shot and streaming paths. The logging doc owns the record. This doc owns that order.
- The prefix is merged into the leading system message for that request. It is not written into the conversation's stored message list. Writing it into message state caused the prefix to show up in the chat transcript.
- Applying the prefix is idempotent, so a retry or stream fallback cannot prepend it twice.
- The node's own base system prompt is separate. The model client applies the prefix. The prompt builder does not need to know the prefix text.
- Resolution order for a node is: the user's saved selection for that node, then that node's default config, then one fallback config.
- A small set of role configs is always available. Version 2 used orchestration, writing, judgment, and structure, each describing why a model was chosen. Keep the role idea. Rebuild the node registry as version 3 nodes appear. Do not copy the scene-writing and intimacy node lists.
- Specific model ids in the version 2 analysis are a point-in-time recommendation. The doc can record them as the version 2 defaults and the reason each role existed. They are not a frozen version 3 requirement.

Done when a later implementation can build the config store, the selector, and the prefixed client without reading the version 2 docs.

### 5. Prompt assembly

Add `architecture/prompt-assembly.md`.

Question: how is the text of one model call constructed, and which context belongs in which layer?

Read [v2/architecture_prompt_assembly.md](v2/architecture_prompt_assembly.md) and the model-configuration doc from Step 4. The logging doc owns the call record. This doc and that one must agree that the recorded prompt is the model request, including the system prompt and the prefix, and not the conversation's stored message list.

Keep the version 2 rule that took the longest to learn. A system prompt that is static for the run is part of the model request. It is not inserted into the conversation message channel. Message-channel middleware is for context that annotates a specific user turn, such as what the user currently has open. Mixing those two was the bug: the system prompt leaked into the assistant's visible reply.

Describe the layers version 3 will use: model-config prefix, node or workflow base prompt, retrieved Story Bible context, and conversation messages. Story Bible context for the arc agent can be read through tools. A summarizing research step is optional later (Linear DEF-56). Say that synthesized context has to stay distinguishable from stored Story Bible statements when that step exists.

Leave the version 2 chat-agent primer and the scene-workflow prompt sequence out. Those describe the old Story Bible.

One stream rule belongs here because it is how the prefix bug became visible. A consumer of the model stream must not render every chunk as assistant text. Filtering by message type is part of keeping a system prompt out of the transcript.

Done when Step 4 and this doc agree on where the prefix is applied, and a caller can tell where a new piece of context should go.

### 6. LLM debug logging

Add `architecture/llm-debug-logging.md`.

Question: how is every model call recorded, and how does that record stay the prompt and response the model actually saw?

Read [v2/architecture_llm_debug_logging.md](v2/architecture_llm_debug_logging.md) and the model-configuration doc from Step 4. The configuration doc owns prefix merging. This doc owns the tap and the record. The evaluations doc cites these records. It does not define a second way to capture prompts.

Capture the rules that took iteration in version 2:

- One tap, on the shared model factory, so every current and later workflow is logged without each node opting in.
- The prefix is already merged before the tap runs, on both the one-shot and streaming entry points. Logging the conversation message list would miss the system prompt and the prefix. Version 2 checked this directly: the start callback sees the merged system message.
- Record start, success, and error. A call that is still running stays visible. If the finish event arrives without a start, still store a record.
- The record includes the run id, status, times, duration, the node or step when the runtime provides it, the model, scrubbed parameters, the prompt both as text and as structured messages, the response text, the tool calls the model requested, response metadata, and the error. Keep the requested tool calls even when the tool later fails.
- Scrub secrets recursively before writing. A key that looks like an API key, authorization header, token, or secret is redacted, including when it is nested.
- Call logs are application debug data. They are not part of a story and they are not in a story export.
- Concurrent calls must not tear the log. Version 2 locked the whole read-modify-write after parallel nodes corrupted the file on Windows. A corrupt log is discarded so the next call can be recorded. A logging failure must not fail the model call. The JSON file and the process lock are the version 2 implementation. They are not a requirement that the hosted store be one file.
- Attribute a call to the story and the workflow step when those exist, so an evaluation run can point at these records for the prompt, the tokens, and the latency. Version 2's log was process-local and had no story id.
- The debug view is read-only. It lists calls newest-first, including failures and calls still running. Prompt markup is shown literally. Version 2's markdown view executed tags such as `<canvas>` that appeared inside prompts. Token counts prefer the client usage metadata and fall back to the provider usage field. The NiceGUI page is not the view to copy.

Done when a later implementation can record a prefixed, streaming, tool-calling model call, and an evaluation run can cite that record, without reading the version 2 logging doc.

### 7. Persistence, tenancy, and concurrency

Add `architecture/persistence.md`. Rewrite the useful parts of [deployment-and-concurrency.md](deployment-and-concurrency.md) into it. After this step, the old draft can remain until Step 12 deletes leftover drafts, or this step can remove it if the new doc fully replaces it. Prefer leaving the old file in place and pointing this README at the new one, so review can diff them.

Question: how is a story saved, who owns it, and what happens when the user and an agent write at the same time?

Read [deployment-and-concurrency.md](deployment-and-concurrency.md), [v3-concept/issues/DEF-50.md](v3-concept/issues/DEF-50.md), [v3-concept/issues/DEF-51.md](v3-concept/issues/DEF-51.md), the world-state and persistence sections of [v2/architecture.md](v2/architecture.md), [v2/architecture_async_jobs.md](v2/architecture_async_jobs.md), and the concurrency-related entries in [v2/known_issues.md](v2/known_issues.md). Use [v2/zip_import_export.md](v2/zip_import_export.md) for the export idea.

Specify the write rules already sketched in the draft: a story is the isolation boundary and has an owner; a write is a transaction; several creates in one transaction can refer to each other; transactions on one story are ordered; a multi-step agent draft commits only if the story revision is still the one it started from; user edits use the same transaction path as agent edits. Local-first storage sits behind that interface. Railway, with Postgres for structured records and object storage for blobs, is the hosted target. Secrets stay out of a story export.

Version 2's form bindings mutated memory and then saved, so a failed save left memory and disk diverged. The transaction has to cover user edits, not only tool calls. A retry after a transient file lock must not freeze the interface. Say whether a conversation belongs to the story and is included in an export. Version 2 kept chat in a side file and omitted it from the ZIP. Close that or leave it open in [open-questions.md](open-questions.md).

Version 2 serialized every tool call in a message because concurrent calls raced. Record that failure and the replacement rule. A process-global file lock and a single in-memory world are the version 2 implementation, not the version 3 design.

Workflows that must survive a process restart stay an open question (DEF-51). The doc should say the durable artifact of an early run is the last successful story transaction, and point durability-beyond-that at open questions.

Done when slice 1 could implement the story store from this doc, and a hosted deployment would not require a new ownership model.

### 8. Agents and arc planning

Add `architecture/agents.md`.

Question: how does an agent change the Story Bible, and what does the first workflow — turning a user's description into story arcs — actually do?

Read [architecture-direction.md](architecture-direction.md), the Story Bible doc from Step 3, the persistence doc from Step 7, [v3-concept/issues/DEF-54.md](v3-concept/issues/DEF-54.md), [v3-concept/issues/DEF-55.md](v3-concept/issues/DEF-55.md), [v3-concept/issues/DEF-56.md](v3-concept/issues/DEF-56.md), and the plot sub-agent section of [v2/architecture_agent_workflows.md](v2/architecture_agent_workflows.md). Use [v2/architecture.md](v2/architecture.md) for the tool-boundary rule.

Keep these patterns: agents mutate the bible only through tools; tools reject unknown ids and return the valid ones; a failed write tool is a recoverable error for the model, not a reason to abort the run or to retry the write blindly; a tool rejects markup that leaked into a field value. A fixed workflow can be a graph with its own step order when the product needs that order. A batch of related edits can be drafted aside and committed once. The first workflow takes a description and writes the entities, properties, assertions, events, and arcs it needs. The user can edit between prompts. Prose is out of this workflow.

An in-flight arc run can be cancelled, and starting it does not freeze the chat turn until the run finishes. Version 2 recorded a cancel flag and never connected it, and `plan_plot` blocked the turn. Whether the user reviews the draft before that single commit is an open choice; name it and point it at [open-questions.md](open-questions.md). Multiple conversations and how tool calls appear in the chat are the same kind of choice, not a separate document.

The version 2 plot sub-agent drafted events in a sandbox and committed them all at once. That commit shape is in scope. Its inline intimacy interpretation is not.

Candidate plot exploration and character-query interviews (DEF-55) are later additions. Mention them as optional and point the open choices at [open-questions.md](open-questions.md). Context assembly beyond read tools is the same: name it, and leave the retrieval-versus-agent decision open.

Done when the arc-planning slice could be implemented from this doc plus the Story Bible and persistence docs, without reading the version 2 workflow doc.

### 9. Evaluations and observability

Add `architecture/evaluations.md`. The current [evaluations.md](evaluations.md) is the draft to rewrite from. Put the finished doc under `architecture/` so evaluation is part of the architecture set. Update links in this README when the new file exists.

Question: how will we tell whether a prompt, model, or workflow change made the result better, and what did it cost?

Read [evaluations.md](evaluations.md), [v3-concept/issues/DEF-52.md](v3-concept/issues/DEF-52.md), [v3-concept/issues/DEF-57.md](v3-concept/issues/DEF-57.md), and the logging doc from Step 6.

The first scored targets are story arcs, then characters and other generated entities, then the bible as a whole. Prose is scored when the prose workflow exists. Every run stores the fixture, the workflow version, the model, the bible before and after, the scores, and the rubric version. The same run stores call count, tokens, cost, and latency by step, by pointing at the call records from Step 6. A prompt change is a workflow version change, so two runs of one fixture can be compared.

Version 2 had the call log and no repeatable quality comparison. The comparison is this doc. Leave the tap, the redaction, and the record shape in the logging doc. Judge-model versus human score, the concrete rubrics, and numeric cost budgets stay open. The doc should still fix the run record so those can be added without a new storage shape.

Done when two arc-workflow versions could be run on the same fixture and compared using only this doc's record.

### 10. Build sequence

Rewrite [build-sequence.md](build-sequence.md) so it points at the finished docs from Steps 2–9.

Question: in what order is the system built, and what does each slice need to be true before the next one starts?

Read the current [build-sequence.md](build-sequence.md) and the docs written so far. Keep the slice order from the decisions section: data model, light editing and visualization, arc-planning agent, evaluations, prose. Name the doc each slice is bound by. Call out dependencies that are real, such as the arc-planning slice recording calls through the logging doc, and evaluations citing those records instead of capturing prompts a second time.

Leave version 2's completed phase list in [v2/implementation_plan.md](v2/implementation_plan.md) as history. Do not renumber this plan to match those phases.

The prose slice's entry in this doc carries the deferred salvage, in enough detail that Step 12 can delete the version 2 snapshots. Create long text by intercepting a tagged stream. Edit it with a targeted patch. Exact match is the fast path; a patch that hits nothing or more than one place returns an error. Unbounded fuzzy search stalled large scenes. If the open document changes mid-stream, roll the partial write back. The pattern worth reusing is an enforced step order, a model config per node, continuity from neighboring units, staleness when the inputs change, and saving each finished step. The version 2 stance and intimacy prompts are not part of that pattern. Readable HTML export waits until there is prose. This is a note for the later slice, not a prose design.

Done when a builder can start slice 1 from the Story Bible and persistence docs and can see what is deliberately waiting.

### 11. Architecture overview

Add `architecture.md` as a short map.

Question: what are the parts of the system, and which doc is the authority for each one?

Read the subsystem docs from Steps 4–9 and [v2/architecture.md](v2/architecture.md) only to notice a boundary the new docs never mentioned. If something important was missed, add it to the subsystem doc that owns it, or record it as an open question. Do not paste the version 2 architecture into this file.

Cover: Python and the agent layer, the Story Bible as the shared state, tools as the mutation path, model configuration, call logging, persistence, the arc workflow, evaluations, and the UI as still undecided. Link out. Repeat a rule only when the overview would be misleading without it.

Done when a reader can find the authority for any subsystem in one page, and this file does not disagree with the subsystem docs.

### 12. Final coverage review

Review the finished set against every source row below.

For each row, confirm the "Accounted for" value is a real finished doc, or an explicit drop with a reason. Read the finished doc far enough to check that the kept mechanism is actually there. Look for leftover instructions that only make sense if the reader also has `v2/` or `v3-concept/` open, and fold that material in or drop it.

Then remove `docs/v2/` and `docs/v3-concept/`. Remove drafts that were replaced, including [v2-import-inventory.md](v2-import-inventory.md). Step 1 did not keep it. Rewrite this README as the index of the finished documents. Leave the completed status table in place so the path that produced them stays visible.

Done when the docs folder contains the accepted document list, the snapshots are gone, and every source row below is either a finished doc or a recorded drop.

## Source coverage

Each writing step updates the rows it accounts for. "Accounted for" stays **No** until then. "Partial" means a step took part of the source and named what is left. The home column is the assignment from Step 1.

### Version 2 snapshots

| Source | Home | Accounted for |
| --- | --- | --- |
| [v2/overview.md](v2/overview.md) | [vision.md](vision.md). The LangGraph-over-product goal priority is dropped. | Yes |
| [v2/README.md](v2/README.md) | [vision.md](vision.md), for the product description only. Setup and NiceGUI run instructions are out until there is a build. | Yes |
| [v2/AGENTS.md](v2/AGENTS.md) | Drop as a repo guide until code exists. Mine the tool-validation and "docs are the authority" habits if a later contributor guide is added. | No |
| [v2/architecture.md](v2/architecture.md) | Architecture overview, persistence, and agents. Drop the NiceGUI module map and the single `world.json` design. | No |
| [v2/story_bible_model.md](v2/story_bible_model.md) | [story-bible.md](story-bible.md). Readable ids and the time/presentation split stay. Replay, signals, and ranks are dropped. | Yes |
| [v2/forms_and_data_models.md](v2/forms_and_data_models.md) | [story-bible.md](story-bible.md), for which fields were editable. Form layout is dropped with NiceGUI. Scene blueprints wait with prose. | Yes |
| [v2/model_configuration.md](v2/model_configuration.md) | Model configuration. | No |
| [v2/model_selection_analysis.md](v2/model_selection_analysis.md) | Model configuration, for the role rationale. Specific model picks stay historical. | No |
| [v2/architecture_prompt_assembly.md](v2/architecture_prompt_assembly.md) | Prompt assembly and model configuration. | No |
| [v2/architecture_llm_debug_logging.md](v2/architecture_llm_debug_logging.md) | LLM debug logging. Evaluations cite the records and do not redefine the tap. | No |
| [v2/architecture_agent_workflows.md](v2/architecture_agent_workflows.md) | Agents, for workflow shape and the plot-draft commit. Scene-writing and intimacy workflows wait or drop. | No |
| [v2/architecture_async_jobs.md](v2/architecture_async_jobs.md) | Persistence, for claims versus real transactions. In-memory job manager is not the hosted design. | No |
| [v2/architecture_document_editing.md](v2/architecture_document_editing.md) | No document now. The build-sequence step records the stream-and-patch salvage for the prose slice. | No |
| [v2/zip_import_export.md](v2/zip_import_export.md) | Persistence, as a later export requirement. Secrets stay out of exports. | No |
| [v2/intimacy-state-change-workflow.md](v2/intimacy-state-change-workflow.md) | Dropped in [story-bible.md](story-bible.md). A belief is a Property or an Assertion. | Yes |
| [v2/known_issues.md](v2/known_issues.md) | No document. [story-bible.md](story-bible.md) took generic blank ids and dangling references. Persistence, agents, and the prose salvage still owe their failures. The rest is version 2 debt. | Partial |
| [v2/future_work.md](v2/future_work.md) | No document. Relationship tracking and arcs are in [story-bible.md](story-bible.md). User review before commit is an agents choice. Scene-workflow ideas wait in the prose salvage. | Partial |
| [v2/implementation_plan.md](v2/implementation_plan.md) | Drop. It records finished version 2 phases. | No |
| [v2/agentic_development.md](v2/agentic_development.md) | Drop until this repo has its own contributor and tooling guide. | No |

### Version 3 concept snapshots

| Source | Home | Accounted for |
| --- | --- | --- |
| [v3-concept/project.md](v3-concept/project.md) | [vision.md](vision.md) has the product direction and drops the architecture-only framing. The architecture overview still owes the workstream map. | Partial |
| [v3-concept/story-bible-data-model-draft-2.md](v3-concept/story-bible-data-model-draft-2.md) | [story-bible.md](story-bible.md). | Yes |
| [v3-concept/issues/DEF-49.md](v3-concept/issues/DEF-49.md) | The whole plan. This documentation effort is that revision. Step 12 confirms the migration inventory lives in the finished docs. | No |
| [v3-concept/issues/DEF-50.md](v3-concept/issues/DEF-50.md) | Persistence. | No |
| [v3-concept/issues/DEF-51.md](v3-concept/issues/DEF-51.md) | Persistence, with long-running durability left open. | No |
| [v3-concept/issues/DEF-52.md](v3-concept/issues/DEF-52.md) | Evaluations. | No |
| [v3-concept/issues/DEF-53.md](v3-concept/issues/DEF-53.md) | [story-bible.md](story-bible.md) for the event model. Signals are out. Causal claims between Events are Assertions. The planner-facing slice is still the agents doc. Physical state stays in Story Space. | Partial |
| [v3-concept/issues/DEF-54.md](v3-concept/issues/DEF-54.md) | Agents. | No |
| [v3-concept/issues/DEF-55.md](v3-concept/issues/DEF-55.md) | Agents, as optional later capability. | No |
| [v3-concept/issues/DEF-56.md](v3-concept/issues/DEF-56.md) | Prompt assembly and agents. | No |
| [v3-concept/issues/DEF-57.md](v3-concept/issues/DEF-57.md) | Evaluations. | No |
| [v3-concept/issues/DEF-90.md](v3-concept/issues/DEF-90.md) | [story-bible.md](story-bible.md). | Yes |
| [v3-concept/related-story-space/](v3-concept/related-story-space/project.md) | No finished doc in the first set. Step 12 records it as deferred related work, still available in Linear and in git history. | No |

### Current drafts

| Source | Home | Accounted for |
| --- | --- | --- |
| [vision.md](vision.md) | Rewritten in place by Step 2. | Yes |
| [story-bible.md](story-bible.md) | Rewritten in place by Step 3. | Yes |
| [architecture-direction.md](architecture-direction.md) | Folded into the architecture overview and the agents doc, then removed. | No |
| [evaluations.md](evaluations.md) | Replaced by `architecture/evaluations.md` in Step 9. | No |
| [deployment-and-concurrency.md](deployment-and-concurrency.md) | Replaced by `architecture/persistence.md` in Step 7. | No |
| [build-sequence.md](build-sequence.md) | Replaced by Step 10. | No |
| [open-questions.md](open-questions.md) | Kept. Step 2 settled questions 1–4. Step 3 settled the slice 1 model, including dropping Event links. Overlap, epistemic markers, and assertion roles stay open. Later steps keep updating it. | Partial |
| [v2-import-inventory.md](v2-import-inventory.md) | Input to Steps 3–9. Removed in Step 12. Step 1 did not keep it as a finished doc. | No |
