# User interface

This is the map of the screens: which ones exist, how they are reached, what they share, and what each one has to answer. A view with enough to specify has its own doc under `ui/`. When this page and a view doc disagree, the view doc is right and this page is fixed.

This doc owns the screens. It does not own what they are built on. [architecture/application.md](architecture/application.md) owns the API the screens call and how the frontend is built and served. [story-bible.md](story-bible.md) owns the records, their rules, and how story time is read. [build-sequence.md](build-sequence.md) decides when each planned screen is built.

## The bar

The UI is supporting work in this project. A screen takes the plainest form that does its job.

A view is specified by the questions it answers, not by its layout. The questions are what the writer is asking while looking at the view. They do not say how the screen answers them, and they are the starting point a design is built from.

A view answers every question in its doc unless the doc says otherwise. When it does not answer them all, its doc says which questions it answers, which it helps with only partly, for example by letting the writer open records in the detail panel, and which are not built yet. The view is done when a person can answer each question it claims to answer from the screen, on the sample stories, without opening the records view or the stored document. A feature that serves none of the questions waits until a question is added to the view's doc.

A development tool is the exception. It helps build or tune a view, such as the layout panel on the graph, and it answers none of the view's questions itself. A view may show one when its doc names it as a development tool and says what it is for and when it moves out of the writer's way.

The layout in a view doc is the first attempt at answering the questions. It can change once the view has been used. The questions change only when the owner changes them.

## Where the screens are

| Address | Screen |
| --- | --- |
| `/` | The story list. |
| `/stories/{story_id}` | One story. The address redirects to `/stories/{story_id}/records`. |
| `/stories/{story_id}/records` | The records view. |
| `/stories/{story_id}/timeline` | The timeline. |
| `/stories/{story_id}/entities` | The entities view. |
| `/stories/{story_id}/graph` | The graph. |

A story's page shows the story's title and a link to each view that is built, in a row under the title. The view on screen is marked. A view is linked once it has a screen, so the page does not offer a view that is not built yet. Each view has its own address, so a view can be added, replaced, or dropped without touching the others, and the view on screen survives a reload. The links keep the query string, so `?record=` carries from one view to the next.

The selected record is part of the address, as `?record={record_id}`. It survives a reload, and it carries from one view to the next: an Entity selected on the graph is still selected when the writer opens the entities view. A view that does not show the selected record ignores it.

A view that turns out not to suit editing is kept as a view. Editing is then reached from the detail panel or from another view, and this table gains a row. It does not lose one.

## What every view shares

### One load

A story's views draw from one `GET /stories/{story_id}` response, loaded when the story's page opens. Moving between views does not load it again.

A view that shows story time also loads what the service computed about it, because the service resolves story time and the frontend does not, as [architecture/application.md](architecture/application.md) says. The timeline loads the Event times. The entities view loads the statement times and the in-force stretches for the Entity on screen. A screen never resolves a time point itself, and it never decides what is in force.

### Selecting a record

Selecting a record in any view opens the detail panel beside the view. The panel shows that record's fields as stored, the records it names, and the records that name it. Each of those is a link that selects that record in turn.

On a wide window, the `md` breakpoint and wider, the panel is a column to the right of the view. On a narrower window it is a drawer over the view, open while a record is selected. Closing the panel clears `?record=`.

The panel edits every kind of record, as [Saving](#saving) says. Every view opens the same panel, so a view does not need an editor of its own, and a new view gets editing by letting the writer select a record.

The references the panel lists are the ones in "How the records connect" in [story-bible.md](story-bible.md). The graph draws the same list as its edges. There is one definition of a reference in the frontend, and both use it.

### How a record is named

A record is shown by its primary text: an Entity's name, a statement, or a title. Its id is available wherever the record's own fields are shown. A reference to another record is shown as that record's primary text, never as a bare id.

### Loading and failure

A view that is loading says so. A story the acting user cannot see is reported as no story at that address, which is what the API's `404` means. Any other failure is shown with its reason, and the screen does not show a partial story.

### Saving

The detail panel edits every kind of record. The story's framing is not a record in the panel: it is edited on the records view's Framing tab, as a `set_story` commit, and that save shows the same outcomes as a save in the panel. The application doc fixes what a save may return. This section says what the writer sees.

A save is a commit, the same commit an import or an agent makes. A failed save writes nothing: the stored story stays as it was, and the unsaved edit stays in the panel so the writer can correct it, retry, or discard it. A refusal has no override. The Story Bible rules hold for the writer as they do for the agent, and a save is refused only for structure, never for the quality of what was written, as [story-bible.md](story-bible.md) says.

#### Editing a record

- The panel shows the record read-only, with an **Edit** button. Edit turns the panel into a form with **Save** and **Cancel**. Cancel drops the unsaved edit and shows the record read-only again. An Entity's form edits its name and its notes. A Property's form edits its statement, its `when`, and `caused_by`, and a Property is created from its Entity's panel. An Event's form edits its title, its description, the Entities that take part, and its `when`. An Assertion's form edits its statement, the Entities, Events, and Arcs it names, its `when`, and `caused_by`. The "at least two records" rule is the service's refusal. An Arc's form and a Narrative Unit's form are described below. A unit's prose is shown and stays empty.
- **Delete** is its own button, and it asks for confirmation first. Deleting an Entity says that its Properties are deleted with it. Deleting a Narrative Unit also takes it out of the list that holds it. A unit that still has units inside it is refused.
- A record is created from a **New** action for its kind. An Entity's is on the records view's Entities tab. A Property's is on its Entity's panel. An Event's is on the Events tab, and on the timeline from a selected moment or stretch, which fills that time in. An Arc's is on the Arcs tab. An Assertion's is on the Assertions tab. A Narrative Unit's is on the Narrative Units tab, and on a unit's panel, which places the new unit inside that one. The form collects the primary text before the record exists, as the identity rules in [story-bible.md](story-bible.md) require, so a blank create never mints an id.
- An update sends only the fields that changed, with the revision the panel loaded. Creating a Narrative Unit, moving it between lists, and deleting it each go out as one commit, because a unit has to stay in exactly one list.
- The panel belongs to the story's page and survives a switch between views. Selecting another record, closing the panel, or leaving the story while an edit is unsaved asks before discarding it. A switch between views keeps the edit.

#### What each outcome shows

- **Committed (`200`).** The story is loaded again, along with what the view loaded about story time, and the panel shows the record read-only. A create selects the new record. A delete closes the panel.
- **Refused (`422`).** The refusal's message is shown. Each problem is shown on the field it names, with the legal ids it lists. Referring records are shown as links, so the writer can open them and fix them first.
- **Conflict (`409`).** The response lists every row that moved. The panel lists each moved row by its primary text, with its current fields, or marked as gone. A row other than the edited record can be in that list. A delete of an Entity also deletes the Properties the commit's snapshot shows it owning. A Property created on that Entity after that snapshot still names it, so the store turns the delete into a conflict, and the panel lists that Property. A Property committed before the delete is sent is in the snapshot and is deleted with the Entity.
  - Beside an unsaved edit, **Save mine anyway** sends the same writes against the current revisions. **Discard mine** drops the edit and shows the stored record. A record that was deleted in the meantime offers only Discard mine.
  - A conflict on a delete has no form to keep. The panel shows the moved rows, with **Delete anyway** and **Cancel**. When the record being deleted is already gone, only Cancel is offered.
- **Busy (`503`).** The message is shown with a **Retry** button that sends the same commit again.

## The views

| View | What it must answer | Status | Doc |
| --- | --- | --- | --- |
| Records | What does each record store, field by field, exactly as stored? | Built. | [Below](#the-records-view). |
| Timeline | When does each Event happen, in what order, what is happening and who is involved at a given time, which Arc is each Event in, and where could a new Event go? | Built. | [ui/timeline.md](ui/timeline.md) |
| Entities | What is true of an Entity and when, what holds at a chosen time, why a claim changed, and which Assertions tie it to other Entities? | Built. | [ui/entities.md](ui/entities.md) |
| Graph | How are the records connected, where are the isolated groups, which records mention some text, what surrounds one record or one Arc, what does an Arc depend on, how would a change affect the story, how are the records related, and what role does an Entity play? | Built for how the records are connected and where the isolated groups are, and not yet readable on a large story. Search and focus are not built. [future-work.md](future-work.md) holds both. | [ui/graph.md](ui/graph.md) |

Each view's questions are stated in full in its doc.

The timeline draws both of the pictures the Story Bible doc requires. Events in story time is the axis. Arcs laid over the Events is the timeline with one Arc highlighted. The entities view and the graph are not required by the Story Bible doc. They are here because the owner asked for them. A view beyond these four is added to this doc first.

### The records view

The records view is the story as stored. It has a tab for the framing and one for each kind of record, with a count. Every field of every record is shown, with the record's id. A `when` list is written out as text, one span at a time, as the spans are stored, including which end of an Event a time point names. It does not decide what is in force.

This is the view that does not interpret. The other views each answer their questions by leaving things out. This one leaves nothing out, so it is where the writer checks what a record actually holds, and it is where every field can be reached. Editing a record opens the detail panel. Editing the framing stays on this view's Framing tab.

### The Arc editor

The Arc editor is the detail panel's form for an Arc. It edits the title, the description, and the Arc's Events. An Event is added from a select, moved up or down, and removed. That order is the Arc's own order, which may differ from story time. Creating and deleting an Arc use the same panel. The timeline, with that Arc highlighted, is where the order is seen against story time.

### Narrative Units

A Narrative Unit is edited in the detail panel as structure. The form edits the title, the summary, the notes, and the Entities, Events, and Arcs it depicts. The prose is shown and stays empty. Where the unit sits is a parent, the story or another unit, and a position in that parent's list. The units inside it are reordered with up and down buttons.

Creating a unit, moving it, and deleting it are each one commit. A create is the new unit plus an update of the parent list that names it. A move updates the list it leaves and the list it joins. A delete takes it out of its parent list and deletes it. A unit that still has units inside it is refused, because those units would be left in no list.

## Screens that are planned

These are required by other docs, and none is built. Each gets a section or a doc here before it is built, and nothing about its layout is decided yet. [build-sequence.md](build-sequence.md) places each one.

| Screen | Required by | Built with |
| --- | --- | --- |
| The history, with what each commit changed and a revert | [architecture/persistence.md](architecture/persistence.md), and [architecture/agents.md](architecture/agents.md), where it is the writer's review of what an agent's turn did | Editing. The arc-planning agent adds the turn. |
| Model configs and the API key | [architecture/model-configuration.md](architecture/model-configuration.md) | The arc-planning agent |
| The chat panel, on the story's latest conversation with an action that starts a new one, and the turn's status | [architecture/application.md](architecture/application.md), and [architecture/agents.md](architecture/agents.md) for which conversation is shown | The arc-planning agent |
| The call list | [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md) | The arc-planning agent |
| Fixtures, runs, and the comparison | [architecture/evaluations.md](architecture/evaluations.md) | Evaluations |

## What the writer does across views

A view answers its own questions. These are the tasks that take more than one view, and they are why selection carries between views.

| Task | Views |
| --- | --- |
| Read a story an import or an agent produced, and understand its shape. | The graph for what exists and how it connects, the timeline for what happens when, the records view for exact fields. |
| Decide where a new Event belongs. | The timeline, with the Entities the Event would involve highlighted, and the detail panel for the Events around the place being considered. |
| Find out why something is true of a character at a point in the story. | The entities view for the Property, then the Event that caused it on the timeline. |
| Find what is thin or disconnected. | The graph. |

Building a bible by hand and reviewing what an agent's turn changed are added to this table when editing and the history view are built.

## Sample stories

A view is judged on stories, so each view has a sample that stresses it. The samples are import documents in `samples/`.

| Sample | What it is for | Stresses |
| --- | --- | --- |
| `samples/sample_story.json` | A small story with every kind of record. The baseline for every screen. | Every screen |
| `samples/timeline_story.json` | A story shaped by time: Events with every shape of span. [ui/timeline.md](ui/timeline.md) lists what it contains. | The timeline |
| `samples/ensemble_story.json` | Several Entities whose Properties change over time and bear on each other through Assertions and shared Events. [ui/entities.md](ui/entities.md) lists what it contains. | The entities view |
| `samples/large_story.json` | Enough records, about 150 to 200, to show whether the graph stays readable. The others hold at most about thirty. [ui/graph.md](ui/graph.md) lists what it contains. | The graph |

## How a screen is checked

Logic that does not render has Vitest tests: laying out resolved spans, assigning lanes, deriving the references between records. What the service computes has its own tests in Python. A screen is not tested by rendering it in a test. It is checked by using it in a browser, against a service on a scratch data directory with the samples imported, and the report says which of the view's questions were answered on which sample. The graph also has a command that saves a screenshot of it, as [ui/graph.md](ui/graph.md) says, so a layout can be judged and compared from images. A screenshot goes with the report of a check in the browser; it does not replace the check. `AGENTS.md` and [architecture/application.md](architecture/application.md) state this rule; this section applies it to the views.

## What stays open

How a screen is drawn is design work recorded in this doc and the view docs. It is not a question in [open-questions.md](open-questions.md). The widget each view is drawn with is chosen in the view's doc. The timeline is drawn with a grid, plain marks, and Mantine. The entities view is selects and lists. The graph is Cytoscape.js with the fcose layout. The owner judged the built views good enough for now. A built view can change once it has been used, and the change is made in its doc.

- What the planned screens look like. Each is designed here or in its own doc before it is built. What each must do is fixed by the doc that requires it, in [Screens that are planned](#screens-that-are-planned), and designing the screen does not change that.
- Whether the chat transcript shows the tool calls and results the turn stream carries. It is decided when the chat panel is designed.
- Whether the story list separates an evaluation run's story from the stories the writer started by hand. It is decided when the screen for runs is designed.
- What each view doc lists under its own "What stays open".
