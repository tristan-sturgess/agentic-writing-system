# Graph

The graph draws every record in a story as a node and every reference between records as an edge. It is built read-only. The work to make it readable on a large story is partly built, and search and focus are not built. [future-work.md](../future-work.md) holds what is left of both. [ui.md](../ui.md) says what it shares with the other views.

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

- **1 and 2: the layout.** Records that reference each other are drawn together, and an isolated group reads as separate on screen. Nothing is computed for the groups. The list of records that connect to nothing, below, answers question 2 for a single record without reading the graph node by node. This answers both on the small samples. It does not yet answer them on the large one, as "What stays open" says.
- **3: search.** Not built. Its design is added here before it is built.
- **4 to 6: focus.** Narrowing the graph to the records around one record or one Arc, to what an Arc depends on, or to what depends on a record. Not built. Its design is added here before it is built.
- **7 and 8: partly, by reading the graph and opening records in the detail panel.** The graph shows that two characters are connected through an Assertion, and the panel shows what the Assertion states. The graph shows how many records name an Entity, and the panel lists them. Nothing more is built or planned for these two. "What stays open" lists the ideas recorded for them.

## Nodes

Every record is a node: each Entity, Property, Assertion, Event, Narrative Unit, and Arc. A node is labelled with the record's primary text, as [ui.md](../ui.md) says a record is named, and coloured by its kind. A legend gives each kind's colour.

The story itself is one more node, because its `unit_ids` name the top-level Narrative Units. It is labelled with the story's title. It cannot be selected, as the detail panel shows the story as a badge and not as a record.

An Entity that owns Properties is drawn in a box with them. The box holds the Entity's node and one node per Property, and the layout keeps them together, so a character and what is true of it read as one place on the graph. The box is not a record. It has no label, it cannot be selected, it is never in the list of records that connect to nothing, and it has no filter toggle. An Entity with no Properties has no box. The box shows while any node in it shows, so hiding Entities leaves their Properties in their boxes, and hiding Properties leaves each Entity in its box.

## Edges

Each reference is an arrow from the record that holds the id to the record it names. An Event that names an Entity in `entity_ids` is an arrow from the Event to the Entity. A Property is an arrow to the Entity that owns it, drawn inside their box.

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

Selecting a node sets `?record=` and opens the detail panel. Selecting the story node or an Entity's box does nothing. The selected node and its edges are emphasised, and the edges show their fields. Arriving with `?record=` already set, from a reload or from another view, emphasises that record. Selecting a record through a link in the panel selects it on the graph in the same way.

A selected record whose kind is hidden stays selected, and the panel stays open. It is not shown on the graph until its kind is shown again.

## Layout, zoom, and pan

The layout places the nodes once, when the view opens, and again only when the layout panel below asks it to. It is a force layout: records that reference each other are pulled together, and the rest are pushed apart, so groups that hang together read as clusters. Changing the filter or the selection does not run it again, so a node stays where the writer last saw it. A hidden kind leaves its space empty.

The layout is repeatable: one story is placed the same way on every load, so a reload, a screenshot, and the writer's memory of where a record sits agree. Two screenshots of one story differ only where the story or the layout changed. The start positions and the layout's random numbers are drawn from the story id and a seed, so the same story with the same settings lands in the same place.

The forces are set by kind. Each kind of record has its own repulsion, and a line takes its length and elasticity from the kind of the record that holds the reference. The line from a Property to its Entity has its own, shorter length, which with the box keeps the Properties close to their Entity. The boxes have their own repulsion. The view opens with a baseline the owner chose from the layout panel on `large_story`, kept in the frontend as the default settings. A new baseline is chosen the same way, from screenshots, and replaces the default.

### The layout panel

The layout panel is a development tool. It answers none of the questions above. It is how the baseline is chosen, and the baseline is what makes questions 1 and 2 answerable on a large story. It is on the screen because the layout is not settled, and it will move behind a setting when it is.

The panel sits beside the graph, under the detail panel and the list of records that connect to nothing. It edits the layout's settings: the seed, the forces for each kind, the line from a Property to its Entity, the boxes' repulsion, and fcose's other options. An edit does nothing until Regenerate, which runs the layout again with the edited settings. Defaults puts the baseline back in the panel. Copy settings puts the settings of the layout on screen on the clipboard as JSON, which is how a chosen layout becomes the next baseline. The settings are not in the address and are not saved, so a reload opens on the baseline.

The graph can be zoomed and panned, and it opens fitted to the window. On a story of hundreds of records a force layout with no zoom is not legible, which is why this view has both and the timeline has neither.

## What the view does not do

- It does not edit. Editing is planned, in the detail panel.
- It does not show story time or reading order. Those are the timeline and, later, the prose.
- It does not add an edge to the model, type an edge, or offer a connect action.
- It does not search or focus. Both are in [future-work.md](../future-work.md).

## The sample

The other samples hold at most about thirty records, too few to show whether the graph stays readable. `samples/large_story.json` is the sample for this view, with about 150 to 200 records across every kind. It contains:

- Several Arcs, some sharing Events.
- Entities with many Properties.
- Assertions that name Entities, Events, and Arcs.
- Properties and Assertions with `caused_by`.
- Spans that name an Event as a time point.
- A Narrative Unit tree at least three levels deep.
- A few records that connect to nothing: an Entity that nothing names, and an Event that names no Entity and that no Arc includes.

It does not yet contain an isolated group: five to ten records that connect to each other and to nothing else, so question 2 can be judged for a group and not only for a single record. Adding one is part of the work in [future-work.md](../future-work.md).

The view is checked by answering questions 1 and 2 for that story from the screen, and then for `samples/sample_story.json`. A change to the layout is checked on the same two questions. Search and focus, when they are built, are checked on questions 3 to 6.

## How it is built

The graph draws from the one `GET /stories/{story_id}` load every view shares. It needs nothing from the service.

The nodes, the merged edges, the records that connect to nothing, and the count for each kind are a function of the story and the hidden kinds. So are the Entity boxes, the seeded start positions, and the layout options built from the settings. That is logic that does not render, with Vitest tests. The edges come from the same function the detail panel uses for its references.

The screen is drawn with [Cytoscape.js](https://js.cytoscape.org/) and its `cytoscape-fcose` layout, wrapped in one React component, with Mantine for the toggles and the list. Cytoscape draws to a canvas and gives zoom, pan, selection, hover, and showing or hiding elements without a new layout. fcose is a fast force layout that suits a general network of a few hundred nodes.

These were set aside:

- **React Flow with ELK.** React Flow draws each node as a DOM element, which suits an editor of a few dozen nodes more than a read-only picture of hundreds. ELK's layered layouts suit a graph that flows one way, and references do not.
- **Columns by kind, in plain SVG.** No library, and each kind in its own column. With a hundred records the edges between columns cross into a band that cannot be read, and the groups questions 1 and 2 ask about do not show.
- **d3-force.** A force layout only. Zoom, pan, hit testing, labels, and drawing would be written by hand, which is the machinery `AGENTS.md` says not to build for the UI.

### The screenshot command

A layout is judged by looking at it, and two layouts are compared side by side, so there is a command for it, `scripts/graph_screenshot.py`. Given a story id, the service's address, an output path, and a window size, it opens the story's graph in a browser, waits until the layout has finished, and saves a PNG of the graph area. It can set the same `?hide=` and `?record=` the address carries. The graph's container marks a finished layout with `data-layout="done"`, which is what the command waits for.

The command uses Playwright for Python with Chromium, as a development tool. It is not part of the app, and it does not test the screen: a screenshot is attached to the report of a check in the browser, and does not replace that check. It runs against a service on a scratch data directory, never on the real `data/`.

## What stays open

- **What makes the large sample readable.** Checked in the browser when the graph was first drawn, the large sample was not readable. It has about 180 records and 460 references. The largest groups of references are Events naming their Entities (about 100), Properties naming their Entity (about 60), and Assertions naming Entities (about 60), and the lines pile into a few main characters. The owner chooses what changes, from screenshots of `large_story` and `sample_story`, each beside the current layout. Chosen so far, built, and written into "Nodes" and "Layout, zoom, and pan" above: tuning the force layout by kind, with a shorter line from a Property to its Entity, and Properties drawn in a box with their Entity. The rest of this work is in [future-work.md](../future-work.md). The candidates still open:
    - **Narrative Units drawn inside their parent unit.** This removes the lines for `child_ids` and the story node's lines.
    - **Quieter lines.** Lines are faint until a node is selected or the pointer is over it, so the clusters read through the pile of lines.

  A change chosen from these is written into "Nodes", "Edges", and "Layout, zoom, and pan" above before it is built. Drawing Narrative Units inside another node changes what this doc says a node is, which is why the choice comes before any code.
- **Where the layout panel goes.** It is on the graph's screen while the layout is being tuned. It moves behind a setting when that work settles. Which setting, and where it lives, is decided then.
- **Showing only the connections between two Entities.** An idea for question 7: the records that connect two chosen Entities, with the rest out of the way. Not built.
- **Measures of an Entity's reach.** An idea for question 8: how many records depend on an Entity, or how central it is to the story. Not built.
- **Laying out again.** For the writer, the layout runs once. Regenerate in the layout panel runs it again, but that is the development tool. A control for the writer to run it again after the filter changes is added if the empty space a hidden kind leaves turns out to get in the way.
