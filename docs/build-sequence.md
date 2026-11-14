# Build sequence

This is the order the system is built in, and what each slice needs before the next one starts. Each slice is usable on its own. Later slices add workflows on the same Story Bible. They do not replace it.

The subsystem docs describe the finished design. This doc decides when each part of it lands. A requirement this doc places in a later step is still a requirement; it is built when that step comes, and it is not dropped. When a subsystem doc and this doc disagree about timing, this doc is right and the subsystem doc is fixed.

An open question that does not block a slice stays in [open-questions.md](open-questions.md). A decision a subsystem doc already closed is not reopened here.

Version 2 was built in phases that are already finished. These slices are not those phases, and they are not numbered to match them.

The accepted docs are the gate. Slice 1 starts from [story-bible.md](story-bible.md) and [architecture/persistence.md](architecture/persistence.md). Nothing in this file is a reason to read the version 2 snapshots to find out what to build.

## How the work is cut

The order puts the writer's view of the story first. The Story Bible and a minimal API come first, then the screens to see and edit it by hand, then the first agent, then the evaluations that judge that agent. The machinery that only matters once an agent and the writer write to one story at the same time is built with the agent, where it can be tested against the case it exists for.

A slice is a milestone. The numbered steps inside it are the units of work. Each step leaves something visible: a test that passes, a command whose output shows the new behavior, or a screen that does something new. A step is small because it does less, not because it does it worse. It follows the docs it is bound by, and it leaves nothing a later step has to undo. If a step turns out bigger than expected, it is split.

| Slice | Bound by | Starts when |
| --- | --- | --- |
| 1. Story Bible and a minimal API | [story-bible.md](story-bible.md). [architecture/persistence.md](architecture/persistence.md), for the story store, the commit, ownership, the commit record, and import. [architecture/application.md](architecture/application.md), for the story endpoints. | The tech stack is chosen and the repository is scaffolded. |
| 2. Editing and visualization | The early pictures in the Story Bible doc. [ui.md](ui.md) and the view docs under `ui/`, for the views and what each must answer. The application doc, for the endpoints the views call. Settled item 21 in [open-questions.md](open-questions.md), for what the frontend is built with. Question 22, which this slice closes. The same commit as slice 1. | A story can be created, edited, and reloaded through the API. |
| 3. Arc-planning agent | [architecture/agents.md](architecture/agents.md), [architecture/model-configuration.md](architecture/model-configuration.md), [architecture/prompt-assembly.md](architecture/prompt-assembly.md), [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md). The persistence doc, for the config, secrets, conversation, and call-log stores, and for the commit's guards and conflict handling. The application doc, for the turn, the stream, and the stop. | A person can build a bible by hand, see it, and revert an edit, and the tweak step has ended. |
| 4. Evaluations | [architecture/evaluations.md](architecture/evaluations.md). The logging doc, by citation. This slice does not capture a prompt a second way. | The arc chat's calls are in the log. |
| 5. Prose | The note in this file. Narrative Units in the Story Bible doc. The scene-score place already reserved in the evaluations doc. | Slices 1–4 are in place. |

## Before slice 1

The tech stack is chosen and recorded in `AGENTS.md`. The frontend framework stayed open until slice 2, which settled it as item 21 before building a view. The repository is scaffolded with one passing test and the commands to set up, run, and test it.

## Slice 1 — Story Bible and a minimal API

Implement the model in [story-bible.md](story-bible.md) on the story store in [architecture/persistence.md](architecture/persistence.md), and put the first endpoints in front of it.

A story has an owner. Locally there is one implicit user, and the owner is still stored. A write is a commit: committed, refused, or in conflict. User edits and later tool calls use that same commit. The caller sees the store interface. It does not see SQLite. A JSON file under a process lock is not what this slice builds.

The schema includes every record in the Story Bible doc, including Narrative Units and the story's framing. A unit's `prose` field exists and stays empty. Leaving the field out would make prose a migration.

1. **Records and rules.** The record schemas, id minting, and the Story Bible rules as code that touches no storage: unknown ids refused with the legal ids, a delete something still names refused with the referring records, the Narrative Unit tree, and span cycles. Visible as tests.
2. **The store and the commit.** The story store on SQLite: a story row and a row per record, each with its own revision, and the store's name check inside the save. The commit loads, applies, checks, and saves. The save writes the commit record with its before-images in the same transaction, because the save already reads them. Visible as tests: a story survives a reload, a refused write leaves the story as it was, and two writes to one record are ordered by its revision.
3. **The story endpoints.** List, create, get, and delete a story, and post a commit, with the three commit outcomes mapped to responses as the application doc says. Every request resolves to the implicit user. Visible as a command that creates a story, commits to it, and reads it back.
4. **Import.** One JSON story document imports as a new story, by the persistence doc's rule: a `create` followed by one commit of the file, ids kept. A small sample story is checked in, so the screens in slice 2 have something to draw from the first view. Visible as a command that imports the sample and lists it.

Deferred to slice 3: the commit's guards on the unit tree and span chains, the conflict reapply, and the busy retry. They exist for an agent writing beside the writer, and they are tested against that case. Until then a conflict is returned to the caller as it is.

Configs, the API key, call logs, and conversations are specified in the persistence doc and are not part of this slice. Nothing in slices 1 or 2 writes them. They are built in slice 3, behind the same interfaces, in the same data directory. They do not get a second design.

This slice has no UI, no agent, and no prose workflow.

Slice 1 is done when a story can be created, edited, and loaded through the API, the integrity rules hold, two writes to one record have a defined outcome, every commit leaves a history record with before-images, and a JSON story document imports as a new story.

## Slice 2 — Editing and visualization

The views on the model from slice 1. The application layer is a Python API with a separate frontend, settled item 34 in [open-questions.md](open-questions.md), so this slice builds the frontend and the remaining story endpoints it calls, including the ones that read story time for a view. The frontend is React and TypeScript, built by Vite, with Mantine components, settled item 21, and [architecture/application.md](architecture/application.md) says how it is built and served. Accounts and a hosted login are not part of this slice. Locally there is still one implicit user, and the API resolves every request to it.

The views come before the editing. What a view has to show is easier to judge on a story that already exists, so the slice first builds each view read-only and checks it against sample stories, and then adds editing to the screens that are there. [ui.md](ui.md) lists the views and the questions each one must answer. Each view has its own doc under `ui/`, and writing that doc is the first act of the view's step.

The Story Bible doc already requires these pictures, whatever widget draws them:

- Events arranged in story time from their spans. Selecting an Event opens it for editing. A relationship between Events is an Assertion, edited with the other Assertions.
- Arcs laid over those Events.

The slice draws two views that doc does not require: one Entity with its Properties over story time, and a graph of every record and the references between them.

Selecting a record in any view opens the same detail panel. In the view steps the panel is read-only. In the editing steps it becomes the editor, so a view does not get an editor of its own. The records view from step 1 stays, as the screen where every field of every record can be reached.

A hand edit is a commit. A failed save leaves the screen and the stored story in agreement, and the edit stays on the screen so the writer can retry or reload.

The views, read-only:

1. **The frontend and a read-only story.** The frontend is scaffolded and served as the application doc says. It lists the stories and shows one story's records. Visible as the sample story on screen. This screen is the records view.
2. **Which end of an Event a time point means.** The `edge` on a time point that names an Event, from the Story Bible doc and settled item 42: the field on the record schema, the refusal of an `at` span that names an Event without one, and the sample story and the records view carrying and showing it. This is a revision to the model slice 1 built, made here because the timeline is the first thing that reads it. Visible as tests, and as a command that commits a span with an `edge` and reads it back.
3. **Event times from the service.** The Story Bible layer resolves each Event's spans to timestamps by the Story Bible doc's rules, and the event-times endpoint in the application doc returns the result, as settled item 43 says. This step adds a sample story whose Events use every shape of span. Visible as a command that prints that sample's resolved times, and the reason for each time that does not resolve.
4. **The timeline.** The first picture, as [ui/timeline.md](ui/timeline.md) specifies it: the axis, the lanes, the Events with no place, and selecting an Event, a moment, or a stretch. This step also gives each view its own address under the story and builds the detail panel. Visible as the sample on the timeline.
5. **Entities and Arcs on the timeline.** The highlight in [ui/timeline.md](ui/timeline.md): the Events one Entity takes part in, or the Events of one Arc. This is the second picture, Arcs laid over the Events, built read-only.
6. **Entities and their Properties.** One Entity with its Properties over story time, their `caused_by` links, and the Assertions that name it. The in-force view from the Story Bible doc is shown here, computed by the service as item 43 says. It adds a sample story with several Entities whose Properties change and bear on each other. Visible as that sample in the view.
7. **The graph.** Every record as a node and every reference as an edge, with a filter by kind of record. A larger sample story is added if the first three are too small to show whether the graph stays readable. Visible as a sample's records and their connections.
8. **Search and focus on the graph.** Finding a record by its text, and narrowing the graph to one Arc or to the records around one record.

The editing:

9. **Entities and Properties.** Create, edit, and delete as structured fields, in the detail panel. A refusal or a conflict is shown with the edit kept.
10. **Events.** Create, edit, and delete. Selecting an Event on the timeline opens it for editing.
11. **Arcs.** The Arc editor: create, edit, and delete, and the order of an Arc's Events. The second picture from step 5 is where the result is seen.
12. **The other records.** Assertions, Narrative Units, and the story framing. A Narrative Unit is edited as structure: its place in the reading order, its children, and its subjects. Its prose stays empty, and this slice does not grow a prose editor.
13. **History, revert, and export.** The history and revert endpoints, and the story's commit history newest first, with what each commit changed and a revert of one commit. The export endpoint, and an export action. In this slice every commit is a hand edit, an import, or a revert. Slice 3 adds the agent's commits to the same list, grouped by turn, and the turn-level revert.
14. **Tweak.** No new features. The writer uses the screens by hand and fixes what gets in the way. A change to the model or a rule found here goes into the docs first, before any agent depends on it. This step closes question 22.

"A little" is the bar. The views make the model inspectable and hand-editable. They do not cover later workflows. The questions in a view's doc are its scope: a feature that answers none of them waits. A view beyond the ones in [ui.md](ui.md) is added to that doc first. The widget that draws a view is chosen in its view doc when its step starts. It is not specified here.

Slice 2 is done when a person can build a small bible by hand, see the events, the arcs, and the entities without reading storage, and revert an edit from the history.

## Slice 3 — Arc-planning agent

A chat agent that takes a description and writes framing, entities, properties, assertions, events, and arcs into the bible the person just edited. [architecture/agents.md](architecture/agents.md) is the authority for that workflow. It is one agent: the chat is the arc planner, and there is no nested planner. The user can edit between prompts with the slice 2 views, and can send another prompt.

This is the first slice that calls a model, so the docs that exist only to support that call land here, not as a later pass. The agent runs from a command before it runs from the screen, so the workflow is visible and testable before the stream and the chat panel exist.

1. **Model configuration and the key.** The config store and the secrets store from the persistence doc. Configs, the four roles, the node registry with the `chat` node, the prefixed agent from the shared builder, and the user's API key, from the model-configuration doc. The config and key endpoints, and the screen where the user edits a config, assigns it, and sets the key, in the UI from slice 2. Visible as a model chosen and a key set on screen.
2. **The call log.** The call-log store, the logging middleware on every call the shared builder makes, and the tool-result record, from the logging doc. Prompt layers from the prompt-assembly doc. Visible as a command that makes one tool-less call and prints its record.
3. **The agent from a command.** The read and write tools and the base prompt from the agents doc, and the checkpointer for the conversation thread. A command sends one prompt to a story and prints the tool calls, their results, and the records that changed. Every call is in the log, attributed to the story, the `chat` node, and the config. Visible as a description turned into arcs, seen on the slice 2 screens.
4. **Chat on screen.** The conversation endpoints, the turn row, the stream of typed events, and the stop, from the application doc. A chat panel renders `assistant_delta` as the reply, and a `commit` event refreshes the records it names. Visible as a prompt sent from the screen and the bible changing while it runs.
5. **The turn in the history.** The agent's commits grouped by turn, and the turn-level revert.
6. **Writing beside the agent.** The work deferred from slice 1: the commit's guards, the conflict reapply, and the busy retry from the persistence doc, and the bounded retry in the write tools from the agents doc. The heartbeat and `interrupted`, and the stream's replay after a reconnect, from the application doc. Visible as tests where the writer edits during a run and a parallel tool batch writes one record twice.
7. **The call list.** The read-only call list, with prompt markup shown literally. The page layout follows the UI from slice 2 and is not specified.

A chat that cannot be attributed to the story, the `chat` node, and the config is not done, because the evaluation slice would otherwise have to capture the prompt a second way.

The workflow does not write prose. It does not hold a draft for review, and no run waits for the writer to approve a commit; the history view with its turn-level revert is the review, as item 23 settles. Candidate explorations and character interviews stay out, as the agents doc says. How many conversations the workspace lists stays open with the UI, and whether the transcript renders the tool calls the stream already carries is a rendering choice in this slice.

Slice 3 is done when a prompt can produce arcs in that same bible, the user can revise the result by hand or with another prompt, the history shows what that turn changed and the turn can be reverted, an in-flight run can be cancelled, the writer can edit during a run without losing either write, and the calls of that turn are in the log.

## Slice 4 — Evaluations

Add evaluations before changing the arc workflow further. [architecture/evaluations.md](architecture/evaluations.md) is the authority for the fixture, the run, the checks, the judge, and the comparison.

The runner uses the same `chat` agent as slice 3. Tokens, cost, and latency are read from the call records slice 3 wrote. The run stores the cited `call_id`s. It does not store a second copy of the prompt. Fixtures and runs are rows in the application database slice 1 created. They are not a second store and they are not part of a story export. There is no budget, and this does not run in CI.

1. **A fixture and a run from a command.** The fixture and run records, and a runner that creates the story, sends the fixture's messages, and stores the fixture, the workflow version, the resolved model, the bible before and after, and the usage. Start with two or three fixtures. Visible as two runs of one fixture printed side by side.
2. **The checks.** `tool_calls` and `id_handling`, written when the run finishes.
3. **The judge.** The `judge` node, the rubric, and the scores with their notes.
4. **The comparison on screen.** The fixture, run, and comparison endpoints, and the screen where the user launches a fixture and reads the comparison, in the UI from slice 2.
5. **The full suite and calibration.** The ten fixtures in the evaluations doc: five for arcs, five for Story Bible construction. The calibration review, with runs whose artifact contains a known fault. Scene fixtures wait for slice 5. The score shape already has a place for them.

Slice 4 is done when two runs of one fixture can be compared, including the checks, the scores, and what the runs cost.

## Slice 5 — Prose

Add the workflow that writes prose into a Narrative Unit from the bible, then score that prose with the scene dimensions the evaluations doc already reserves. Five scene fixtures join the suite. Those runs cite the same call log.

This section is the note for that slice. It is not the prose design. The agents doc already says the workflow is a graph with its own entry point, and that the chat agent does not carry the steps as tools it can skip. Version 2's scene graph is a source of lessons. It is not the workflow to port.

### Creating the text

Long prose is not a JSON tool argument. The model writes it in the ordinary text response, wrapped in tags. The consumer reads the token stream, and from the opening tag pipes the following tokens into the open Narrative Unit, until the closing tag. Version 2 used a canvas tag. The tag name belongs to the prose design. The interception is the mechanism.

The stream rule in the prompt-assembly doc still holds. Assistant text is rendered as text. The intercepted span is the unit's prose, not a second copy in the transcript. A consumer that renders every chunk as assistant text is how a system prompt leaked into version 2's chat, and it would dump the prose there too.

### Editing the text

A later edit is a targeted patch: a match string and a replacement. Exact match is the fast path. Zero matches, or more than one, is an error returned to the model, with enough surrounding text to try again. The tool does not apply a guess.

Version 2 fell through from a missed exact match into a windowed fuzzy search. On a long scene and a long target that search grew with the document length, the window range, and the square of the target, and it stalled the agent for seconds. The common path never reached it, because an exact quote returned first. The search is not part of this slice. A cheaper anchor, if one is ever added, has to stay bounded. An unbounded scan of the unit is the failure.

### A stream that does not finish

If the open unit changes while a tagged stream is in progress, or the stream ends without the closing tag, the partial text rolls back to what that unit held when its stream started. A patch that already committed in the same run stays committed. Rollback undoes the unfinished stream, not a successful write.

Version 2 kept one snapshot, for the unit the run ended on. A truncated stream that had been appended to an earlier unit survived on that earlier unit until the next authoritative write. Each unit the run streams into keeps its own snapshot. The partial is not saved as the unit's prose.

### The workflow pattern

What to reuse from version 2's scene workflow:

- The edges fix the step order. The model does not skip or reorder them.
- Each node that calls a model has its own registry entry and resolves its own config, so a cheap step and the drafting step can differ. Prose nodes are added to the registry when this slice starts. The model-configuration doc already says that.
- Continuity comes from neighboring Narrative Units. The previous unit contributes its prose. The next unit, and units tied to the same events, contribute a summary. A neighbor with no prose yet contributes its plan, labeled as a plan rather than as written prose. Version 2 picked the previous scene by event chronology, fell back to list order, sent full prose backward and summaries forward, and used the scene card when prose was missing. The selection rule is redesigned against this Story Bible. The depth split and the label are the part worth keeping.
- Each finished step is saved when it finishes, through the same commit as any other write. A later failure leaves the earlier steps in the story. Version 2 preferred that visibility to holding the whole run for one commit.
- When the inputs the prose was generated from change, the prose is marked stale. Regenerating discards the generated text, and the writer is told that before it happens. The writer can copy the unit aside first. Version 2 fingerprinted the scene card and showed a stale badge.
- A review that finds the unit's plan contradicting the Story Bible is shown to the writer. It does not rewrite the bible to match the prose. If the same error is in an earlier generated step and in the prose, the revision names the earlier step. Several reviewers in parallel are optional. One bounded review is enough to start.

Version 2 stored an outline and per-character stances beside the scene, and its prompts weighted those stances by intimacy. Those prompts are not part of the pattern. A Narrative Unit has no stance field and no blueprint field. Whether this workflow stores an outline or any other generated artifact, and where, is decided when the slice is designed. It does not become a record type in slice 1.

### Export

The story export from slice 2 stays one JSON document until this slice. When prose exists, the story export can be a zip of that document plus the prose blobs, as the persistence doc says. Configs, the API key, call logs, and conversations stay out.

A separate readable HTML package also waits until there is prose. Version 2's package was export only: an index and one HTML page per scene in reading order, markdown rendered to HTML, titles and summaries escaped, a shared stylesheet, and previous and next links. There was no import. Here the pages follow the reading order of the Narrative Units. The package is for reading outside the app. It is not the story export.

Slice 5 is done when a workflow can fill a unit's prose from the bible, the writer can revise that prose by hand or with a prompt, a partial stream rolls back, a patch that does not match exactly once returns an error, and two prose runs of one fixture can be compared on the same evaluation record.

## Explicitly later

These are not missing slices. The docs already say they wait.

- Hosted deployment on Railway. Slice 1's store interface is what makes that a deployment rather than a new ownership model. Postgres, the bucket, encryption of the API key, and how a request authenticates are the hosted half of the persistence doc. Building them is later. The local app is the first runtime. The retention routine from the application doc is built with them: locally the log has no cap, and the only rows it would clear are old heartbeats. Hosting does not depend on any slice after 2, so it can be pulled forward without reordering them.
- A workflow that must survive a process restart. An early run lives in the process. The durable artifact is the last successful commit. Question 29.
- The Story Space location agent, routes, and time scrubber. Location entities can exist from slice 1. The writer and the arc agent edit them directly until that project is pulled in.
- Candidate plot explorations and character-query interviews. Question 32. The arc chat reads through tools until then.
- How many conversations the workspace lists. Question 24. It can be added without reordering these slices.
- A stricter overlap rule, a fact-or-belief marker, richer Assertion references, and a story-specific calendar. Questions 26–28 and 38. They are Story Bible revisions if a story needs them, not build slices.
