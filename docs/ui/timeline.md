# Timeline

The timeline arranges a story's Events in story time. A highlight draws the Events of one Entity or one Arc. It draws both of the pictures [story-bible.md](../story-bible.md) requires: Events in story time, and Arcs laid over them. Selecting an Event opens the detail panel, where the Event is edited. A new Event can be started from a selected moment or stretch, with that time filled in. [ui.md](../ui.md) says what it shares with the other views.

Story time comes from the spans in each Event's `when`. The Story Bible doc owns what a span means and how a time point that names an Event resolves to a timestamp. The service does the resolving, as [architecture/application.md](../architecture/application.md) says, and this view draws what the service returns. This doc says how. It does not restate the rules, and it does not add to them.

## The questions

1. **When does each Event happen?** At one moment, at several, or across a period, and at what story time, as precisely as the story records it.
2. **In what order do the Events happen?** For every Event whose time is known, what comes before it, what comes after it, and what shares its time.
3. **What is happening at a given time?** Every Event in progress at a moment or across a stretch the writer picks. In a story with several threads this is more than one Event.
4. **Who is involved at a given time?** The Entities that take part in the Events in progress at a moment or a stretch. And for one Entity, a character or a place: which Events it takes part in, when, and where it is in two at once or in none.
5. **Which Arc is each Event in?** For one Arc, which Events make it up and where they fall in story time. Which Arcs include a given Event, and that Arc's own order, are in the detail panel.
6. **How is each time known?** Whether a time was written as a timestamp or taken from another Event, which Event, and which end of it. A time taken from another Event moves when that Event moves, so this is also the answer to what else an edit would move.
7. **Which Events have no place, and why?** The Events the timeline cannot place, apart from the ones it can, each with the reason.
8. **Where could a new Event go?** For any stretch of story time: how long it is, what happens just before and just after, what is in progress across it, who is already taken up in it, and enough about those Events to judge whether a new one fits.

Questions 1 to 3 are the picture. Questions 4 and 5 say what the picture is about: whose Events these are, and which threads they make. Questions 6 and 7 keep it honest: a time that is derived is not shown as if it were written, and an Event with no known time is not given a position it does not have. Question 8 is what the picture is for. The view answers it by making a stretch between two moments something the writer can select and read, by showing who is free in that stretch, and by putting each Event's description one click away.

Question 8 is asked by an agent as well as by the writer. An agent does not use this screen. Its read tool, when the agent is built, returns the same resolved times from the service, which is why the resolving is done there.

## What an Event's time can be

This is what the model stores, and so what the view draws. Each row is one case the timeline has to handle.

| What the story records | The spans | How it is drawn |
| --- | --- | --- |
| One moment | One `at` | A point at that moment. |
| Several separate moments | Several `at` spans | A point at each. Nothing is drawn between them. |
| A period | A `range` with both bounds | A bar from the start to the end. |
| A period with one bound unknown | A `range` with one bound absent | A bar from the known bound that ends open after a short length. It does not run to the edge of the timeline, because a missing bound means unknown, not ongoing. |
| A period with neither bound recorded | A `range` with no bounds | Not placed. |
| No time | An empty `when` | Not placed. |
| A time taken from another Event | A point or bound that names an Event | Placed at the moment that Event starts or ends, whichever the point means, and marked as derived. |
| A time that does not resolve | A point or bound that names an Event with no time, with several spans, or with the needed bound absent | Not placed. |

An Event can mix these. Each of its spans is drawn by its own row of the table.

The model cannot record that an Event happens once at some unknown moment inside a window, or that it comes after another Event with no time given for either. The timeline draws only what is stored. The first case waits in [future-work.md](../future-work.md). The second is question 1 in [open-questions.md](../open-questions.md), and it is answered before the arc-planning agent is designed.

## The axis

Time runs down the page.

The axis is a list of moments, not a ruler. A moment is a distinct timestamp that some Event's point or bound resolves to. The moments are in chronological order, evenly spaced, and each is labelled with its timestamp as the story wrote it. A date with no time of day sits at the start of that day, as the Story Bible doc says.

Between each two neighbouring moments is a stretch. The stretch is labelled with the story time it covers, such as "3 days" or "45 minutes". Space on the page does not stand for time. The label does.

An even spacing was chosen over a proportional one because a story's Events are not spread evenly. A decade of backstory followed by one night would put the whole night in one pixel of a proportional axis, and reading it would need zoom and pan. On an even axis every Event is legible at once, and order and overlap, which are questions 2 and 3, read directly. What it gives up is seeing a duration as a length. The labels on the stretches carry that. A proportional axis can be added as a second mode if the labels turn out not to be enough.

## Events on the axis

Each Event has a lane, a column beside the axis that holds its marks. A point is a dot on its moment. A bar runs from its start moment to its end moment. An open bar is the short open-ended bar in the table above.

Two Events share a lane only when one is over before the other begins. Events that overlap are side by side, so every Event in progress at a moment is found by reading across from that moment.

A point or a bound taken from another Event is drawn differently from one written as a timestamp. It sits on the moment that Event starts or ends, whichever the point means: the `edge` it stores, or the one its place in the span gives it.

Each Event's title is listed once, beside the lanes, level with the moment its first mark starts at, and joined to that mark. Several Events that start at one moment are listed together at that moment. A moment's row is as tall as its titles need. The title stands alone. An Arc's name beside it, and a number for its place in an Arc, crowded the list, so neither is drawn.

## Reading it

### An Event

Selecting an Event, by its title or by any of its marks, opens it in the detail panel from [ui.md](../ui.md). The panel shows the title, the description, the `when` list as written, the Entities that take part, the Arcs that include it, the Assertions that name it, the statements it caused, and the spans elsewhere that use it as a time point. On the timeline, the selected Event's marks are emphasised, together with the Events it takes its time from and the Events that take their time from it.

The detail panel was chosen over expanding the title in place because it is the panel every view shares, and it is the one that becomes the editor.

### A moment or a stretch

Selecting a moment or a stretch answers questions 3 and 4. The view names the moment, or the stretch and its length, and lists the Events in progress there, each with the Entities that take part in it: the Events with a point on the moment, and the Events with a bar that reaches or crosses it. An Event whose bar began earlier and has no recorded end is listed apart, as begun and not known to have ended. The same holds for an Event with a recorded end and no recorded start. The Events not in progress are dimmed.

Selecting a stretch is also how question 8 is answered. The stretch shows its length, the Events on either side, the Events across it, and the Entities those Events take up, and each of those opens in the detail panel.

### One Entity or one Arc

The timeline has a highlight: one Entity or one Arc the writer picks, from a control above the axis or by selecting an Entity's name in a moment or a stretch. The Events that belong to the highlight are drawn in full, and the rest are dimmed. With no highlight every Event is drawn in full. The highlight is in the address, as `?highlight={record_id}`, beside the selected record. Selecting an Event does not clear it, so the writer can highlight an Arc and open its Events one after another.

With an Entity highlighted, the Events that name it in `entity_ids` are the ones drawn in full. This is the second half of question 4. Two of them side by side is the Entity in two Events at once. A stretch with none is a stretch where the story says nothing about that Entity. A place is an Entity, so this is also what happens at a place.

With an Arc highlighted, the Events in its `event_ids` are the ones drawn in full. This is the second picture, Arcs laid over the Events, and it answers which Events make up that Arc and where they fall in story time. An Arc's Events with no place are highlighted in the list below the axis, so an Arc is never shown as shorter than it is. The Arc's own order, which may differ from story time, is the numbered list of its Events in the detail panel.

One highlight at a time is the first version. Several Arcs at once, each in its own colour, or the Events two Entities share, are added when a question here needs them.

## Events with no place

Below the axis is a list of the Events the timeline could not place, in groups, each Event with its reason:

- **Time unspecified.** The `when` list is empty, or holds a range with neither bound.
- **Not resolved.** A point or a bound names an Event that does not resolve to one timestamp. The reason names the Event the chain stopped at and says why: it has no time, it has several spans, or the start or end that is needed is not recorded. The reason is the one the service returns.
- **Ends before it starts.** A range whose bounds resolve, with the start after the end. The Story Bible doc lists this as a known issue that a save does not check when a bound is an Event. The timeline is where the writer sees it.

An Event with one span that can be placed and one that cannot is drawn on the axis for the first and listed here for the second.

These Events are selectable like any other, and they take part in the highlight like any other. They have no order among themselves, and the list is in the order the records were created.

## What the timeline does not do

- It does not edit a record in place. Selecting an Event opens the detail panel, where it is edited. A selected moment or stretch can start a new Event with that time filled in: a moment becomes one `at` span at that timestamp, and a stretch becomes one `range` from the earlier moment to the later one. An Arc is edited in the same panel, and highlighting that Arc here shows the result.
- It does not show Properties or Assertions in time. That is the entities view.
- It does not show reading order. Narrative Units present Events in an order of their own, and that order is not story time.
- It does not read an Assertion as an order. "The letter follows the arrival" is a claim the detail panel shows. It does not move either Event.
- It does not resolve a time point. The service does, and the view draws the result.
- It has no zoom, no pan, and no dragging.

## The sample

`samples/timeline_story.json` is a sample story whose Events cover every row of the table above. It has:

- Moments written as a date and moments written as a date and time.
- Two Events at the same moment.
- Three periods that overlap, one of them inside another.
- A period that starts at another Event, a period that ends at another Event, and a time taken from an Event whose own time is taken from a third.
- Times taken from an Event that is itself a period: its start and its end, each once by an `edge` and once by the place of the point in its span.
- An Event with several separate moments.
- A period with no recorded start, and one with no recorded end.
- An Event with no time.
- An Event that does not resolve because the Event it names has no time, and one that does not resolve because the Event it names has several spans.
- A range between two Events that ends before it starts.
- Two scales: years of backstory, then one night told in minutes.
- An Entity that takes part in two Events that overlap, a place that several Events name, and an Event that names no Entity.
- Two Arcs that share an Event, an Arc whose order differs from story time, an Arc that includes an Event with no place, and an Event in no Arc.

The view is checked by answering the eight questions for that story from the screen, and then for `samples/sample_story.json`.

## How it is built

The times come from the service. `GET /stories/{story_id}/event-times` in [architecture/application.md](../architecture/application.md) returns, for each span of each Event, the timestamp each point and bound resolves to, or the reason it does not. The view loads that with the story. The resolving has its own tests in the service.

Arranging those times is the frontend's part: the moments, the stretches and their lengths, the lanes, the groups of Events with no place, and which Events belong to a highlight. That is logic that does not render. It is a function of the story and the resolved times, with Vitest tests, one per row of the table and one per group.

The layout is rows and lanes, so it is drawn with a grid, plain SVG where a mark needs it, and Mantine for the rest. It adds no chart or timeline library. Such a library would be chosen for a proportional axis with zoom, and this view has neither. If the proportional mode is added, that is when a library is weighed.

## What stays open

- **Times the model cannot store.** An Event placed only as before or after another is question 1 in [open-questions.md](../open-questions.md). An Event at an unknown moment inside a window is in [future-work.md](../future-work.md).
