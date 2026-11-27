# Build sequence

This is the order the proof of concept is built in, and what each slice needs before the next one starts. The proof of concept is the six slices below: a Story Bible, the views that show it, editing it by hand, an agent that plans arcs into it, evaluations of that agent, and prose. Each slice is usable on its own. Later slices add workflows on the same Story Bible. They do not replace it.

Work for after the proof of concept is in [future-work.md](future-work.md). An item there is not part of this sequence until the owner moves it here.

The subsystem docs describe the finished design. This doc decides when each part of it lands. A requirement this doc places in a later step is still a requirement; it is built when that step comes, and it is not dropped. When a subsystem doc and this doc disagree about timing, this doc is right and the subsystem doc is fixed.

This is the only doc that names slices and steps. The other docs say what is built and what is planned, and they leave the order to this one.

An open question that does not block a slice stays in [open-questions.md](open-questions.md). A decision a subsystem doc already closed is not reopened here.

Version 2 was built in phases that are already finished. These slices are not those phases, and they are not numbered to match them. The accepted docs are the gate. Nothing in this file is a reason to read the version 2 snapshots to find out what to build.

## How the work is cut

The order puts the writer's view of the story first. The Story Bible and a minimal API come first, then the screens to see it, then editing it by hand, then the first agent, then the evaluations that judge that agent, then prose. The machinery that only matters once an agent and the writer write to one story at the same time is built with the agent, where it can be tested against the case it exists for.

A slice is a milestone. The numbered steps inside it are the units of work. Each step leaves something visible: a test that passes, a command whose output shows the new behavior, or a screen that does something new. A step is small because it does less, not because it does it worse. It follows the docs it is bound by, and it leaves nothing a later step has to undo. If a step turns out bigger than expected, it is split.

A slice that is built is summarized here without its steps. The docs it is bound by say how it works.

| Slice | Status | Bound by | Starts when |
| --- | --- | --- | --- |
| 1. Story Bible and a minimal API | Built | [story-bible.md](story-bible.md). [architecture/persistence.md](architecture/persistence.md), for the story store, the commit, ownership, the commit record, and import. [architecture/application.md](architecture/application.md), for the story endpoints. | The tech stack is chosen and the repository is scaffolded. |
| 2. Views | Built | The early pictures in the Story Bible doc. [ui.md](ui.md) and the view docs under `ui/`, for the views and what each must answer. The application doc, for the endpoints the views call and for how the frontend is built and served. | A story can be created, edited, and reloaded through the API. |
| 3. Editing | Next | [ui.md](ui.md), for the detail panel, saving, and the screens this slice adds. The application doc, for the commit's outcomes and the history, revert, and export endpoints. The persistence doc, for the history, the revert, and the export. The same commit as slice 1. | A person can see the events, the arcs, and the entities of a story without reading storage. |
| 4. Arc-planning agent | Not started | [architecture/agents.md](architecture/agents.md), [architecture/model-configuration.md](architecture/model-configuration.md), [architecture/prompt-assembly.md](architecture/prompt-assembly.md), [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md). The persistence doc, for the config, secrets, conversation, and call-log stores, and for the commit's guards and conflict handling. The application doc, for the turn, the stream, and the stop. | A person can build a bible by hand, see it, and revert an edit, and the tweak step has ended. |
| 5. Evaluations | Not started | [architecture/evaluations.md](architecture/evaluations.md). The logging doc, by citation. This slice does not capture a prompt a second way. | The arc chat's calls are in the log. |
| 6. Prose | Not started | The note in this file. Narrative Units in the Story Bible doc. The scene-score place already reserved in the evaluations doc. | Slices 1–5 are in place. |

## Slice 1 — Story Bible and a minimal API

Built. The model in [story-bible.md](story-bible.md) is implemented on the story store in [architecture/persistence.md](architecture/persistence.md), with the first endpoints in front of it. A story can be created, edited, and loaded through the API, the integrity rules hold, two writes to one record have a defined outcome, every commit leaves a history record with before-images, and a JSON story document imports as a new story.

- **Records and rules.** The record schemas for every record in the Story Bible doc, including Narrative Units and the story's framing, id minting, and the Story Bible rules as code that touches no storage: unknown ids refused with the legal ids, a delete something still names refused with the referring records, the Narrative Unit tree, and span cycles. A unit's `prose` field exists and stays empty, so prose is not a migration later.
- **The store and the commit.** The story store on SQLite: a story row and a row per record, each with its own revision. A write is a commit. It loads, applies, checks, and saves, and it is committed, refused, or in conflict. The save writes the commit record with its before-images in the same transaction. A story has an owner. Locally there is one implicit user, and the owner is still stored.
- **The story endpoints.** List, create, get, and delete a story, and post a commit, with the three commit outcomes mapped to responses as the application doc says. `scripts/story_api.py` is a command-line client for them.
- **Import.** One JSON story document imports as a new story: a `create` followed by one commit of the file, ids kept. `samples/sample_story.json` is a small story to import.

Left for slice 4: the commit's guards on the unit tree and span chains, the conflict reapply, and the busy retry. They exist for an agent writing beside the writer, and they are tested against that case. Until then a conflict is returned to the caller as it is. The config, secrets, call-log, and conversation stores are also built in slice 4, behind the interfaces the persistence doc gives them, in the same data directory.

## Slice 2 — Views

Built. The frontend shows the model from slice 1 in four read-only views, each checked against sample stories. A person can see the events, the arcs, and the entities of a story without reading storage. [ui.md](ui.md) lists the views and the questions each one must answer, and each view has its own doc under `ui/`.

- **The frontend and the records view.** The frontend is React and TypeScript, built by Vite, with Mantine components, settled item 21 in [open-questions.md](open-questions.md), and it is served as [architecture/application.md](architecture/application.md) says. It lists the stories and shows every field of every record in one story.
- **Which end of an Event a time point means.** The `edge` on a time point that names an Event, settled item 42, and the refusal of an `at` span that names an Event without one. This revised the model slice 1 built, because the timeline was the first thing to read it.
- **Story time from the service.** The Story Bible layer resolves spans to timestamps and computes what is in force, settled item 43. The event-times, statement-times, in-force, and in-force-stretches endpoints return the results, and a view draws them.
- **The timeline.** [ui/timeline.md](ui/timeline.md): the axis, the lanes, the Events with no place, selecting an Event, a moment, or a stretch, and the highlight of one Entity or one Arc. These are the two pictures the Story Bible doc requires: Events in story time, and Arcs laid over them.
- **An address per view and the detail panel.** Each view has its own address under the story. Selecting a record in any view opens the same read-only detail panel.
- **The entities view.** [ui/entities.md](ui/entities.md): one Entity with its Properties over story time, their `caused_by` links, the Assertions that name it, and what is in force in a chosen stretch.
- **The graph.** [ui/graph.md](ui/graph.md): every record as a node and every reference as an edge, a filter by kind of record, and the list of records that connect to nothing. The first work on a readable layout is also built: a layout that places one story the same way on every load, each Entity drawn in a box with its Properties, forces set by kind, the layout panel that tunes them, and `scripts/graph_screenshot.py`, which saves a screenshot of the graph so layouts can be compared.
- **Sample stories.** `samples/timeline_story.json`, `samples/ensemble_story.json`, and `samples/large_story.json`, each added to stress one view.

Nothing can be edited on screen. That is slice 3. The rest of the graph's work, a large story that reads well and search and focus, is in [future-work.md](future-work.md).

## Slice 3 — Editing

Editing on the screens slice 2 built, and the story endpoints that are left: history, revert, and export. Accounts and a hosted login are not part of this slice. Locally there is still one implicit user, and the API resolves every request to it.

Selecting a record in any view opens the same detail panel. It is read-only now, and in this slice it becomes the editor, so a view does not get an editor of its own. The records view stays, as the screen where every field of every record can be reached.

A hand edit is a commit. A failed save leaves the screen and the stored story in agreement, and the edit stays on the screen so the writer can retry or reload.

How the panel shows a save, a refusal, and a conflict, and how each new screen is drawn, is written into [ui.md](ui.md) or the view's doc as the first act of its step.

1. **Entities and Properties.** Create, edit, and delete as structured fields, in the detail panel. A refusal or a conflict is shown with the edit kept.
2. **Events.** Create, edit, and delete. Selecting an Event on the timeline opens it for editing.
3. **Arcs.** The Arc editor: create, edit, and delete, and the order of an Arc's Events. The timeline with that Arc highlighted is where the result is seen.
4. **The other records.** Assertions, Narrative Units, and the story framing. A Narrative Unit is edited as structure: its place in the reading order, its children, and its subjects. Its prose stays empty, and this slice does not grow a prose editor.
5. **History, revert, and export.** The history and revert endpoints, and the story's commit history newest first, with what each commit changed and a revert of one commit. The export endpoint, and an export action. In this slice every commit is a hand edit, an import, or a revert. Slice 4 adds the agent's commits to the same list, grouped by turn, and the turn-level revert.
6. **Tweak.** No new features. The writer uses the screens by hand and fixes what gets in the way. A change to the model or a rule found here goes into the docs first, before any agent depends on it.

"A little" is the bar. The screens make the model inspectable and hand-editable. They do not cover later workflows. The questions in a view's doc are where its design starts: a feature that serves none of them waits. A screen beyond the ones in [ui.md](ui.md) is added to that doc first.

Slice 3 is done when a person can build a small bible by hand and revert an edit from the history.

## Slice 4 — Arc-planning agent

A chat agent that takes a description and writes framing, entities, properties, assertions, events, and arcs into the bible the person just edited. [architecture/agents.md](architecture/agents.md) is the authority for that workflow. It is one agent: the chat is the arc planner, and there is no nested planner. The user can edit between prompts on the screens from slices 2 and 3, and can send another prompt.

This is the first slice that calls a model, so the docs that exist only to support that call land here, not as a later pass. The agent runs from a command before it runs from the screen, so the workflow is visible and testable before the stream and the chat panel exist.

1. **Model configuration and the key.** The config store and the secrets store from the persistence doc. Configs, the four roles, the node registry with the `chat` node, the prefixed agent from the shared builder, and the user's API key, from the model-configuration doc. The config and key endpoints, and the screen where the user edits a config, assigns it, and sets the key, in the frontend from slice 2. Visible as a model chosen and a key set on screen.
2. **The call log.** The call-log store, the logging middleware on every call the shared builder makes, and the tool-result record, from the logging doc. Prompt layers from the prompt-assembly doc. Visible as a command that makes one tool-less call and prints its record.
3. **The agent from a command.** The read and write tools and the base prompt from the agents doc, and the checkpointer for the conversation thread. A command sends one prompt to a story and prints the tool calls, their results, and the records that changed. Every call is in the log, attributed to the story, the `chat` node, and the config. Visible as a description turned into arcs, seen on the slice 2 views.
4. **Chat on screen.** The conversation endpoints, the turn row, the stream of typed events, and the stop, from the application doc. A chat panel renders `assistant_delta` as the reply, and a `commit` event refreshes the records it names. Visible as a prompt sent from the screen and the bible changing while it runs.
5. **The turn in the history.** The agent's commits grouped by turn, and the turn-level revert.
6. **Writing beside the agent.** The work left from slice 1: the commit's guards, the conflict reapply, and the busy retry from the persistence doc, and the bounded retry in the write tools from the agents doc. The heartbeat and `interrupted`, and the stream's replay after a reconnect, from the application doc. Visible as tests where the writer edits during a run and a parallel tool batch writes one record twice.
7. **The call list.** The read-only call list, with prompt markup shown literally. The page layout follows the frontend from slice 2 and is not specified.

A chat that cannot be attributed to the story, the `chat` node, and the config is not done, because slice 5 would otherwise have to capture the prompt a second way.

The workflow does not write prose. It does not hold a draft for review, and no run waits for the writer to approve a commit; the history view with its turn-level revert is the review, as item 23 settles. Candidate explorations and character interviews stay out, as the agents doc says. How many conversations the workspace lists stays open with the UI, and whether the transcript renders the tool calls the stream already carries is a rendering choice in this slice.

Slice 4 is done when a prompt can produce arcs in that same bible, the user can revise the result by hand or with another prompt, the history shows what that turn changed and the turn can be reverted, an in-flight run can be cancelled, the writer can edit during a run without losing either write, and the calls of that turn are in the log.

## Slice 5 — Evaluations

Add evaluations before changing the arc workflow further. [architecture/evaluations.md](architecture/evaluations.md) is the authority for the fixture, the run, the checks, the judge, and the comparison.

The runner uses the same `chat` agent as slice 4. Tokens, cost, and latency are read from the call records slice 4 wrote. The run stores the cited `call_id`s. It does not store a second copy of the prompt. Fixtures and runs are rows in the application database slice 1 created. They are not a second store and they are not part of a story export. There is no budget, and this does not run in CI.

1. **A fixture and a run from a command.** The fixture and run records, and a runner that creates the story, sends the fixture's messages, and stores the fixture, the workflow version, the resolved model, the bible before and after, and the usage. Start with two or three fixtures. Visible as two runs of one fixture printed side by side.
2. **The checks.** `tool_calls` and `id_handling`, written when the run finishes.
3. **The judge.** The `judge` node, the rubric, and the scores with their notes.
4. **The comparison on screen.** The fixture, run, and comparison endpoints, and the screen where the user launches a fixture and reads the comparison, in the frontend from slice 2.
5. **The full suite and calibration.** The ten fixtures in the evaluations doc: five for arcs, five for Story Bible construction. The calibration review, with runs whose artifact contains a known fault. Scene fixtures wait for slice 6. The score shape already has a place for them.

Slice 5 is done when two runs of one fixture can be compared, including the checks, the scores, and what the runs cost.

## Slice 6 — Prose

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

Version 2 stored an outline and per-character stances beside the scene, and its prompts weighted those stances by intimacy. Those prompts are not part of the pattern. A Narrative Unit has no stance field and no blueprint field. Whether this workflow stores an outline or any other generated artifact, and where, is decided when the slice is designed. It is not a record type in the model slice 1 built.

### Export

The story export from slice 3 stays one JSON document until this slice. When prose exists, the story export can be a zip of that document plus the prose blobs, as the persistence doc says. Configs, the API key, call logs, and conversations stay out.

A separate readable HTML package also waits until there is prose. Version 2's package was export only: an index and one HTML page per scene in reading order, markdown rendered to HTML, titles and summaries escaped, a shared stylesheet, and previous and next links. There was no import. Here the pages follow the reading order of the Narrative Units. The package is for reading outside the app. It is not the story export.

Slice 6 is done when a workflow can fill a unit's prose from the bible, the writer can revise that prose by hand or with a prompt, a partial stream rolls back, a patch that does not match exactly once returns an error, and two prose runs of one fixture can be compared on the same evaluation record.

## After the proof of concept

The slices end with prose. [future-work.md](future-work.md) holds what comes after: the rest of the graph's work, hosted deployment, and the other things the docs already say wait. They are not missing slices. An item is moved into this sequence, as a step or a new slice, when the owner decides to build it.
