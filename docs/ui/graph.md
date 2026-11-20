# Graph

The graph draws every record in a story as a node and every reference between records as an edge. Step 7 of slice 2 in [build-sequence.md](../build-sequence.md) builds it read-only, step 8 makes it readable on a large story, and step 9 adds search and focus. [ui.md](../ui.md) says what it shares with the other views.

A reference is an id one record stores that names another, as "How the records connect" in [story-bible.md](../story-bible.md) lists them. The detail panel lists the same references, and both draw them from one definition in the frontend. This view adds no edge record to the model. It is not version 2's graph of typed edges, as the Story Bible doc says.

## The questions

These are what the writer is asking while looking at the graph. They do not say how the screen answers them; the next section does.

1. **How are the records connected?** Which records a record names, which records name it, and which records gather many references.
2. **Where are the isolated groups?** The groups of records that connect to each other and to nothing else, down to a single record that connects to nothing.
3. **Which records mention some text?** Every record whose text contains what the writer is looking for, whichever field it is in.
4. **What surrounds one record or one Arc?** The records near it, with the rest of the story out of the way.
5. **What does an Arc depend on?** The records an Arc needs, directly or through the records it names.
6. **How would a change affect the story?** The records that depend on one record, and would be touched if it changed or were removed.
7. **How are the records related?** What a connection means, such as the relationship between two characters, or the part a character plays in an Event.
8. **What role does an Entity play in the story, and how much does it matter?**

Question 2 is part of the writer's task of finding what is thin or disconnected in [ui.md](../ui.md). A record or a group that connects to nothing is usually one an import or an agent left behind: an Entity no Event involves, or an Event no Arc includes and no Entity takes part in.

## How the view answers them

- **1 and 2: the layout.** Records that reference each other are drawn together, and an isolated group reads as separate on screen. Nothing is computed for the groups. The list of records that connect to nothing, below, answers question 2 for a single record without reading the graph node by node. Step 7 answers both on the small samples, and step 8 on the large one.
- **3: search.** Step 9 builds it, and its design is added here when that step starts.
- **4 to 6: focus.** Narrowing the graph to the records around one record or one Arc, to what an Arc depends on, or to what depends on a record. Step 9 builds it, and its design is added here when that step starts.
- **7 and 8: partly, by reading the graph and opening records in the detail panel.** The graph shows that two characters are connected through an Assertion, and the panel shows what the Assertion states. The graph shows how many records name an Entity, and the panel lists them. Nothing is built for these two in steps 7 to 9. "What stays open" lists the ideas recorded for them.

## Nodes

Every record is a node: each Entity, Property, Assertion, Event, Narrative Unit, and Arc. A node is labelled with the record's primary text, as [ui.md](../ui.md) says a record is named, and coloured by its kind. A legend gives each kind's colour.

The story itself is one more node, because its `unit_ids` name the top-level Narrative Units. It is labelled with the story's title. It cannot be selected, as the detail panel shows the story as a badge and not as a record.

## Edges

Each reference is an arrow from the record that holds the id to the record it names. An Event that names an Entity in `entity_ids` is an arrow from the Event to the Entity. A Property is an arrow to the Entity that owns it.

When one record names another through more than one field, such as an Assertion that names an Event in `event_ids` and as `caused_by`, the two references are one edge, and the edge lists both fields. Two records that each name the other are two edges.

Field names are not printed on every edge, because on a large story they cover the graph. An edge shows its fields when the pointer is over it, and the edges of the selected record show theirs.

## What connects to nothing

A record with no reference in either direction is drawn with a dashed border. Beside the graph is a list of those records, with a count, grouped by kind. Selecting one in the list selects it on the graph and opens the detail panel. A story where every record connects says so.

The story node is not a record, so it is never in the list. Its references count for the records they name, so a top-level Narrative Unit is connected.

The list is computed on the whole story, before the filter below. Hiding a kind does not make a record look unconnected because the records that named it are hidden, and a hidden record that connects to nothing is still listed.

## The filter by kind

Above the graph is one toggle for each kind, with the number of records of that kind. Hiding a kind hides its nodes and every edge that touches them. The story node is hidden with the Narrative Units, because its only edges go to them.

The hidden kinds are in the address, as `?hide=` with the kinds separated by commas, such as `?hide=property,assertion`. The kinds are `entity`, `property`, `assertion`, `event`, `unit`, and `arc`. The filter survives a reload, and it is absent when every kind is shown, which is how the view opens.

## Selecting

Selecting a node sets `?record=` and opens the detail panel. The selected node and its edges are emphasised, and the edges show their fields. Arriving with `?record=` already set, from a reload or from another view, emphasises that record. Selecting a record through a link in the panel selects it on the graph in the same way.

A selected record whose kind is hidden stays selected, and the panel stays open. It is not shown on the graph until its kind is shown again.

## Layout, zoom, and pan

The layout places the nodes once, when the view opens. It is a force layout: records that reference each other are pulled together, and the rest are pushed apart, so groups that hang together read as clusters. Changing the filter or the selection does not run it again, so a node stays where the writer last saw it. A hidden kind leaves its space empty.

Step 8 makes the layout repeatable: one story is placed the same way on every load, so a reload, a screenshot, and the writer's memory of where a record sits agree. Two screenshots of one story differ only where the story or the layout changed.

The graph can be zoomed and panned, and it opens fitted to the window. On a story of hundreds of records a force layout with no zoom is not legible, which is why this view has both and the timeline has neither.

## What the view does not do

- It does not edit. Step 10 adds that, in the detail panel.
- It does not show story time or reading order. Those are the timeline and, later, the prose.
- It does not add an edge to the model, type an edge, or offer a connect action.
- It does not search or focus. Step 9 adds both.

## The sample

The existing samples hold at most about thirty records, too few to show whether the graph stays readable. Step 7 adds `samples/large_story.json`, with about 150 to 200 records across every kind. It contains:

- Several Arcs, some sharing Events.
- Entities with many Properties.
- Assertions that name Entities, Events, and Arcs.
- Properties and Assertions with `caused_by`.
- Spans that name an Event as a time point.
- A Narrative Unit tree at least three levels deep.
- A few records that connect to nothing: an Entity that nothing names, and an Event that names no Entity and that no Arc includes.
- From step 8, an isolated group of five to ten records that connect to each other and to nothing else, so question 2 can be judged for a group and not only for a single record.

Step 7 is checked by answering questions 1 and 2 for that story from the screen, and then for `samples/sample_story.json`. Step 8 checks the same two questions again on the changed layout, and step 9 checks questions 3 to 6.

## How it is built

The graph draws from the one `GET /stories/{story_id}` load every view shares. It needs nothing from the service.

The nodes, the merged edges, the records that connect to nothing, and the count for each kind are a function of the story and the hidden kinds. That is logic that does not render, with Vitest tests. The edges come from the same function the detail panel uses for its references.

The screen is drawn with [Cytoscape.js](https://js.cytoscape.org/) and its `cytoscape-fcose` layout, wrapped in one React component, with Mantine for the toggles and the list. Cytoscape draws to a canvas and gives zoom, pan, selection, hover, and showing or hiding elements without a new layout. fcose is a fast force layout that suits a general network of a few hundred nodes.

These were set aside:

- **React Flow with ELK.** React Flow draws each node as a DOM element, which suits an editor of a few dozen nodes more than a read-only picture of hundreds. ELK's layered layouts suit a graph that flows one way, and references do not.
- **Columns by kind, in plain SVG.** No library, and each kind in its own column. With a hundred records the edges between columns cross into a band that cannot be read, and the groups questions 1 and 2 ask about do not show.
- **d3-force.** A force layout only. Zoom, pan, hit testing, labels, and drawing would be written by hand, which is the machinery `AGENTS.md` says not to build for the UI.

### The screenshot command

A layout is judged by looking at it, and two layouts are compared side by side, so step 8 adds `scripts/graph_screenshot.py`. Given a story id, the service's address, an output path, and a window size, it opens the story's graph in a browser, waits until the layout has finished, and saves a PNG of the graph area. It can set the same `?hide=` and `?record=` the address carries. The graph's container marks a finished layout with `data-layout="done"`, which is what the command waits for.

The command uses Playwright for Python with Chromium, as a development tool. It is not part of the app, and it does not test the screen: a screenshot is attached to the report of a check in the browser, and does not replace that check. It runs against a service on a scratch data directory, never on the real `data/`.

The steps:

| Step | What it builds | Questions it answers |
| --- | --- | --- |
| 7 | The nodes and edges, what connects to nothing, the filter by kind, selecting a record, and the larger sample. | 1 and 2, on the small samples. |
| 8 | The screenshot command, a repeatable layout, an isolated group in the large sample, and the layout changes the owner chooses. | 1 and 2, on the large sample. |
| 9 | Search by a record's text, and focus on one record or one Arc. | 3 to 6. |

## What stays open

- **What makes the large sample readable.** Checked in the browser after step 7, the large sample is not readable. It has about 180 records and 460 references. The largest groups of references are Events naming their Entities (about 100), Properties naming their Entity (about 60), and Assertions naming Entities (about 60), and the lines pile into a few main characters. Step 8 is where the owner chooses what changes, from screenshots of `large_story` and `sample_story`, each beside the current layout. The candidates:
    - **Tuning the force layout.** A shorter line from a Property to its Entity than for other references, stronger repulsion between nodes, and separate groups laid out apart from each other.
    - **Properties drawn inside their Entity.** The Entity becomes a box holding its Properties, which removes a line per Property. A Property is still a node that can be selected.
    - **Narrative Units drawn inside their parent unit.** This removes the lines for `child_ids` and the story node's lines.
    - **Quieter lines.** Lines are faint until a node is selected or the pointer is over it, so the clusters read through the pile of lines.

  The chosen changes are written into "Nodes", "Edges", and "Layout, zoom, and pan" above before they are built. Drawing Properties or Narrative Units inside another node changes what this doc says a node is, which is why the choice comes before any code.
- **Showing only the connections between two Entities.** An idea for question 7: the records that connect two chosen Entities, with the rest out of the way. Not built in steps 7 to 9.
- **Measures of an Entity's reach.** An idea for question 8: how many records depend on an Entity, or how central it is to the story. Not built in steps 7 to 9.
- **Laying out again.** The layout runs once. A control to run it again after the filter changes is added if the empty space a hidden kind leaves turns out to get in the way.
