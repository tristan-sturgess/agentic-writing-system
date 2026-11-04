# Build sequence

This is the order the system is built in, and what each slice needs before the next one starts. Each slice is usable on its own. Later slices add workflows on the same Story Bible. They do not replace it.

An open question that does not block a slice stays in [open-questions.md](open-questions.md). A decision a subsystem doc already closed is not reopened here.

Version 2's [implementation plan](v2/implementation_plan.md) records phases that are already finished. These slices are not those phases, and they are not numbered to match them.

The accepted docs are the gate. Slice 1 starts from [story-bible.md](story-bible.md) and [architecture/persistence.md](architecture/persistence.md). Nothing in this file is a reason to read the version 2 snapshots to find out what to build.

| Slice | Bound by | Starts when |
| --- | --- | --- |
| 1. Story Bible | [story-bible.md](story-bible.md). [architecture/persistence.md](architecture/persistence.md), for the story store, the commit, ownership, and the JSON export. | These docs are accepted. |
| 2. Editing and visualization | The early pictures in the Story Bible doc. [architecture/application.md](architecture/application.md), for the API the views call. Questions 21 and 22 in [open-questions.md](open-questions.md), which this slice closes. The same commit as slice 1. | A story can be saved and loaded, and the application doc is accepted. |
| 3. Arc-planning agent | [architecture/agents.md](architecture/agents.md), [architecture/model-configuration.md](architecture/model-configuration.md), [architecture/prompt-assembly.md](architecture/prompt-assembly.md), [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md). The persistence doc, for the config, secrets, conversation, and call-log stores. | A person can build a bible by hand and see it. |
| 4. Evaluations | [architecture/evaluations.md](architecture/evaluations.md). The logging doc, by citation. This slice does not capture a prompt a second way. | The arc chat's calls are in the log. |
| 5. Prose | The note in this file. Narrative Units in the Story Bible doc. The scene-score place already reserved in the evaluations doc. | Slices 1–4 are in place. |

## Slice 1 — Story Bible

Implement the model in [story-bible.md](story-bible.md) on the story store in [architecture/persistence.md](architecture/persistence.md).

A story has an owner. Locally there is one implicit user, and the owner is still stored. A write is a commit: committed, refused, or in conflict. User edits and later tool calls use that same commit. A revision belongs to a record, so two writes to one record are ordered and two writes to different records both land. The caller sees the store interface. It does not see SQLite. A JSON file under a process lock is not what this slice builds.

The schema includes every record in the Story Bible doc, including Narrative Units and the story's framing. A unit's `prose` field exists and stays empty. Leaving the field out would make prose a migration.

Slice 1 exports and imports one JSON story document. There are no blobs and no bucket. Configs, the API key, call logs, and conversations are specified in the persistence doc and are not part of this slice. Nothing in slices 1 or 2 writes them. They are built in slice 3, behind the same interfaces, in the same data directory. They do not get a second design.

This slice has no UI, no agent, and no prose workflow.

Slice 1 is done when a story can be created, saved, and loaded, the integrity rules hold, two concurrent writes have a defined outcome, every commit leaves a history record with before-images that a revert can be built from, and an export of that story is one JSON document that imports as a new story.

## Slice 2 — Editing and visualization

A small set of views on the model from slice 1. The application layer is a Python API with a separate frontend, settled item 34 in [open-questions.md](open-questions.md), so this slice builds two things: the first endpoints of that API, and the frontend that calls them. The API endpoints in this slice are stories, records, the commit, the history and its revert, and export and import, as [architecture/application.md](architecture/application.md) defines them. The frontend framework is chosen here. React is a candidate. NiceGUI and the other in-process Python frameworks are out with item 34. The choice closes question 21 before any view is built. Accounts and a hosted login are not part of the choice. Locally there is still one implicit user, and the API resolves every request to it.

The Story Bible doc already requires these pictures, whatever widget draws them:

- Events arranged in story time from their spans. Selecting an Event opens it for editing. A relationship between Events is an Assertion, edited with the other Assertions.
- Arcs laid over those Events.

The same slice edits the records as structured fields: Entities and their notes and Properties, Assertions, Events, Narrative Units, Arcs, and the story framing. A Narrative Unit is edited as structure: its place in the reading order, its children, and its subjects. Its prose stays empty, and this slice does not grow a prose editor. The in-force view is read-only.

A hand edit is a commit. A failed save leaves the screen and the stored story in agreement. A retry after a transient lock does not freeze the screen.

The slice also shows the story's commit history from the persistence doc, newest first, with what each commit changed, and lets the writer revert one commit. In this slice every commit is a hand edit or an import. Slice 3 adds the agent's commits to the same list, grouped by turn, and the turn-level revert. The view is part of question 22.

"A little" is the bar. The views make the model inspectable and hand-editable. They do not cover later workflows, and they do not add graph types beyond the two pictures until question 22 is closed. The widget that draws those pictures is part of that question. It is not specified here.

Slice 2 is done when a person can build a small bible by hand and see the events, the arcs, and the entities without reading storage.

## Slice 3 — Arc-planning agent

A chat agent that takes a description and writes framing, entities, properties, assertions, events, and arcs into the bible the person just edited. [architecture/agents.md](architecture/agents.md) is the authority for that workflow. The user can edit between prompts with the slice 2 views, and can send another prompt.

This is the first slice that calls a model, so the docs that exist only to support that call land here, not as a later pass:

- Model configs, the four roles, the `chat` node, the user's API key, and the prefixed agent, from the model-configuration doc. The screen where the user edits a config and assigns it is part of this slice, in the UI chosen in slice 2.
- Prompt layers and the stream filter, from the prompt-assembly doc. The chat renders assistant text only.
- The logging middleware and the tool-result record, from the logging doc, on every call the shared builder makes. The read-only call list is part of this slice. Prompt markup is shown literally. The page layout follows the UI from slice 2 and is not specified.
- The config store, the secrets store, the conversation rows, and the call-log store, from the persistence doc.
- The conversation endpoints, the turn stream, the stop, and the heartbeat, from the application doc. The chat is the first endpoint that streams, and the first one that has to carry a stop to a running turn.

The arc chat records its calls through that tap. Slice 4 cites those records. A chat that cannot be attributed to the story, the `chat` node, and the config is not done, because the evaluation slice would otherwise have to capture the prompt a second way.

The workflow does not write prose. It does not hold a draft for review, and no run waits for the writer to approve a commit; the history view with its turn-level revert is the review, as item 23 settles. Candidate explorations, character interviews, and a research summary stay out, as the agents doc says. How many conversations the workspace lists stays open with the UI, and whether the transcript renders the tool calls the stream already carries is a rendering choice in this slice.

Slice 3 is done when a prompt can produce arcs in that same bible, the user can revise the result by hand or with another prompt, the history shows what that turn changed and the turn can be reverted, an in-flight run can be cancelled, and the calls of that turn are in the log.

## Slice 4 — Evaluations

Add evaluations before changing the arc workflow further. [architecture/evaluations.md](architecture/evaluations.md) is the authority for the fixture, the run, the checks, the judge, and the comparison.

The runner uses the same `chat` agent as slice 3. It stores the fixture, the workflow version, the resolved model, and the bible before and after. It runs the deterministic checks and the judge. Tokens, cost, and latency are read from the call records slice 3 wrote. The run stores the cited `call_id`s. It does not store a second copy of the prompt.

Fixtures and runs are rows in the application database slice 1 created. They are not a second store and they are not part of a story export.

The user launches a fixture and reads the comparison. There is no budget, and this does not run in CI. The screen follows the UI from slice 2.

The first suite is the ten fixtures in the evaluations doc: five for arcs, five for Story Bible construction. Scene fixtures wait for slice 5. The score shape already has a place for them.

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

Slice 1's export stays one JSON document until this slice. When prose exists, the story export can be a zip of that document plus the prose blobs, as the persistence doc says. Configs, the API key, call logs, and conversations stay out.

A separate readable HTML package also waits until there is prose. Version 2's package was export only: an index and one HTML page per scene in reading order, markdown rendered to HTML, titles and summaries escaped, a shared stylesheet, and previous and next links. There was no import. Here the pages follow the reading order of the Narrative Units. The package is for reading outside the app. It is not the story export.

Slice 5 is done when a workflow can fill a unit's prose from the bible, the writer can revise that prose by hand or with a prompt, a partial stream rolls back, a patch that does not match exactly once returns an error, and two prose runs of one fixture can be compared on the same evaluation record.

## Explicitly later

These are not missing slices. The docs already say they wait.

- Hosted deployment on Railway. Slice 1's store interface is what makes that a deployment rather than a new ownership model. Postgres, the bucket, encryption of the API key, and how a request authenticates are the hosted half of the persistence doc. Building them is later. The local app is the first runtime.
- A workflow that must survive a process restart. An early run lives in the process. The durable artifact is the last successful commit. Question 29.
- The Story Space location agent, routes, and time scrubber. Location entities can exist from slice 1. The writer and the arc agent edit them directly until that project is pulled in.
- Candidate plot explorations, character-query interviews, and a research step that compresses the bible. Questions 31 and 32. The arc chat reads through tools until then.
- How many conversations the workspace lists. Question 24. It can be added without reordering these slices.
- A stricter overlap rule, a fact-or-belief marker, richer Assertion references, and a story-specific calendar. Questions 26–28 and 38. They are Story Bible revisions if a story needs them, not build slices.
