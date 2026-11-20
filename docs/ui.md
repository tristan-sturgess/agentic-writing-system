# User interface

This is the map of the screens: which ones exist, how they are reached, what they share, and what each one has to answer. A view with enough to specify has its own doc under `ui/`. When this page and a view doc disagree, the view doc is right and this page is fixed.

This doc owns the screens. It does not own what they are built on. [architecture/application.md](architecture/application.md) owns the API the screens call and how the frontend is built and served. [story-bible.md](story-bible.md) owns the records, their rules, and how story time is read. [build-sequence.md](build-sequence.md) decides when each screen is built.

## The bar

The UI is supporting work in this project. A screen takes the plainest form that does its job.

A view is specified by the questions it answers, not by its layout. The questions are what the writer is asking while looking at the view. They do not say how the screen answers them, and they are the starting point a design is built from.

A view answers every question in its doc unless the doc says otherwise. When it does not answer them all, its doc says which questions it answers, which it helps with only partly, for example by letting the writer open records in the detail panel, and which wait for a later step. The view is done when a person can answer each question it claims to answer from the screen, on the sample stories, without opening the records view or the stored document. A feature that serves none of the questions waits until a question is added to the view's doc.

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

A view that shows story time also loads what the service computed about it, because the service resolves story time and the frontend does not, as settled item 43 in [open-questions.md](open-questions.md) says. The timeline loads the Event times. The entities view loads the statement times and the in-force stretches for the Entity on screen. A screen never resolves a time point itself, and it never decides what is in force.

### Selecting a record

Selecting a record in any view opens the detail panel beside the view. The panel shows that record's fields as stored, the records it names, and the records that name it. Each of those is a link that selects that record in turn.

On a wide window, the `md` breakpoint and wider, the panel is a column to the right of the view. On a narrower window it is a drawer over the view, open while a record is selected. Closing the panel clears `?record=`.

In the view steps of slice 2 the panel is read-only. In the editing steps it becomes the editor. Every view opens the same panel, so a view does not need an editor of its own, and a new view gets editing by letting the writer select a record.

The references the panel lists are the ones in "How the records connect" in [story-bible.md](story-bible.md). The graph draws the same list as its edges. There is one definition of a reference in the frontend, and both use it.

### How a record is named

A record is shown by its primary text: an Entity's name, a statement, or a title. Its id is available wherever the record's own fields are shown. A reference to another record is shown as that record's primary text, never as a bare id.

### Loading and failure

A view that is loading says so. A story the acting user cannot see is reported as no story at that address, which is what the API's `404` means. Any other failure is shown with its reason, and the screen does not show a partial story.

### Saving

No screen saves anything until step 10 of slice 2. The application doc already fixes what a save may return and that the writer's edit stays on screen through a refusal, a conflict, or a busy error. How the panel shows each of those is specified here when that step starts.

## The views

| View | What it must answer | Built in | Doc |
| --- | --- | --- | --- |
| Records | What does each record store, field by field, exactly as stored? | Slice 2, step 1. Built. | [Below](#the-records-view). |
| Timeline | When does each Event happen, in what order, what is happening and who is involved at a given time, which Arc is each Event in, and where could a new Event go? | Slice 2, steps 3 to 5. Built. | [ui/timeline.md](ui/timeline.md) |
| Entities | What is true of an Entity and when, what holds at a chosen time, why a claim changed, and which Assertions tie it to other Entities? | Slice 2, step 6. Built. | [ui/entities.md](ui/entities.md) |
| Graph | How are the records connected, where are the isolated groups, which records mention some text, what surrounds one record or one Arc, what does an Arc depend on, how would a change affect the story, how are the records related, and what role does an Entity play? | Slice 2, steps 7 to 9. Step 7 built. | [ui/graph.md](ui/graph.md) |

Each view's questions are stated in full in its doc.

The timeline draws both of the pictures the Story Bible doc requires. Events in story time is the axis. Arcs laid over the Events is the timeline with one Arc highlighted. The entities view and the graph are not required by the Story Bible doc. They are here because the owner asked for them.

### The records view

The records view is the story as stored. It has a tab for the framing and one for each kind of record, with a count. Every field of every record is shown, with the record's id. A `when` list is written out as text, one span at a time, as the spans are stored, including which end of an Event a time point names. It does not decide what is in force.

This is the view that does not interpret. The other views each answer their questions by leaving things out. This one leaves nothing out, so it is where the writer checks what a record actually holds, and it is where every field can be reached once editing exists.

## Screens later steps add

These are required by other docs. Each gets a section or a doc here when its step starts, and nothing about its layout is decided yet.

| Screen | Required by | Built in |
| --- | --- | --- |
| The Arc editor | [story-bible.md](story-bible.md) | Slice 2, step 12 |
| The history, with what each commit changed and a revert | [architecture/persistence.md](architecture/persistence.md), and item 23 in [open-questions.md](open-questions.md) | Slice 2, step 14. Slice 3 adds the turn. |
| Model configs and the API key | [architecture/model-configuration.md](architecture/model-configuration.md) | Slice 3 |
| The chat panel and the turn's status | [architecture/application.md](architecture/application.md) | Slice 3 |
| The call list | [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md) | Slice 3 |
| Fixtures, runs, and the comparison | [architecture/evaluations.md](architecture/evaluations.md) | Slice 4 |

## What the writer does across views

A view answers its own questions. These are the tasks that take more than one view, and they are why selection carries between views.

| Task | Views |
| --- | --- |
| Read a story an import or an agent produced, and understand its shape. | The graph for what exists and how it connects, the timeline for what happens when, the records view for exact fields. |
| Decide where a new Event belongs. | The timeline, with the Entities the Event would involve highlighted, and the detail panel for the Events around the place being considered. |
| Find out why something is true of a character at a point in the story. | The entities view for the Property, then the Event that caused it on the timeline. |
| Find what is thin or disconnected. | The graph. |

Building a bible by hand and reviewing what an agent's turn changed are added to this table with the editing steps and the history view.

## Sample stories

A view is judged on stories, so each view step adds a sample that stresses that view. The samples are import documents in `samples/`.

| Sample | What it is for | Added in |
| --- | --- | --- |
| `samples/sample_story.json` | A small story with every kind of record. The baseline for every screen. | Slice 1 |
| A story shaped by time | Events with every shape of span. [ui/timeline.md](ui/timeline.md) lists what it contains. | Slice 2, step 3 |
| `samples/ensemble_story.json` | Several Entities whose Properties change over time and bear on each other through Assertions and shared Events. [ui/entities.md](ui/entities.md) lists what it contains. | Slice 2, step 6 |
| `samples/large_story.json` | Enough records, about 150 to 200, to show whether the graph stays readable. The others hold at most about thirty. [ui/graph.md](ui/graph.md) lists what it contains. | Slice 2, step 7 |

## How a screen is checked

Logic that does not render has Vitest tests: laying out resolved spans, assigning lanes, deriving the references between records. What the service computes has its own tests in Python. A screen is not tested by rendering it in a test. It is checked by using it in a browser, against a service on a scratch data directory with the samples imported, and the report says which of the view's questions were answered on which sample. From step 8 the graph also has a command that saves a screenshot of it, as [ui/graph.md](ui/graph.md) says, so a layout can be judged and compared from images. A screenshot goes with the report of a check in the browser; it does not replace the check. `AGENTS.md` and item 21 in [open-questions.md](open-questions.md) state this rule; this section applies it to the views.

## What stays open

- The widget each view is drawn with. It is chosen in the view's doc when its step starts. This is the part of question 22 that slice 2 closes one view at a time. The timeline is drawn with a grid, plain marks, and Mantine, as its doc says. The entities view is selects and lists, as its doc says. The graph is Cytoscape.js with the fcose layout, as its doc says.
- What the later screens look like. Each is decided at its step.
