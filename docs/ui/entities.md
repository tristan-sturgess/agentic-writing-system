# Entities

The entities view shows one Entity: what is true of it, when that holds, and how it is tied to other Entities. It is built read-only. [ui.md](../ui.md) says what it shares with the other views.

Story time and what is in force come from the service, as settled item 43 in [open-questions.md](../open-questions.md) says. The Story Bible doc owns what a span means, how a time point that names an Event resolves, and which statements are in force at a query point. This doc says how the view draws the service's result. It does not restate those rules, and it does not add to them.

## The questions

1. **What is true of this Entity, and when?** Each of its Properties, with every span read in story time: the timestamp it resolves to, or the Event and the end of that Event it was read as, or that it does not resolve and why. A Property with an empty `when` is a standing claim and is marked as holding throughout. An `at` span is an observation at that point.
2. **What holds at a chosen time?** The Properties of this Entity, and the Assertions that name it, that are in force at a time the writer picks. A statement the reading includes because a comparison did not resolve is marked, with the reason. A statement the spans place outside that time is absent. An `at` span on its own never appears here.
3. **Why did a claim change?** The Event in `caused_by` on a Property or an Assertion, as a link that selects that Event. The detail panel then shows the Event, and the timeline opens on it because the selected record carries between views.
4. **How is this Entity tied to others?** The Assertions that name it, each with the other Entities, Events, and Arcs they name. An Assertion that does not name this Entity is not listed, including one that is in force for the story as a whole.

Question 2 is asked by an agent as well as by the writer. An agent does not use this screen. Its read tool, when the agent is built, returns the same result from the service, which is why item 43 puts the reading there.

## One Entity

The Entity on screen is named by `?entity=` in the address. A control lists every Entity. Choosing one sets `?entity=` and leaves `?record=` as it is, so the detail panel does not open on the Entity.

Beneath the control the view shows that Entity's name as a heading, then its id and its notes. Those are the fields the detail panel shows for an Entity, so the name is not a link.

When `?entity=` is absent, or is not an Entity in the story, the view chooses one and writes it into the address:

- `?record=` an Entity: that Entity.
- `?record=` a Property: the Entity that owns it.
- Otherwise the first Entity in the story.

Selecting a Property or an Assertion after that changes `?record=` only, so the Entity stays. Arriving from another view with an Entity already selected, and no `?entity=`, shows that Entity. A story with no Entities says so.

The detail panel is the one every view shares.

## Properties

The Properties of the Entity are a list, one to a row, in story order. An Entity's claims are read one at a time. Which of them hold together is question 2, and the in-force list at a chosen time is what answers it. A second axis of bars would repeat the timeline for a handful of rows, so this view does not draw one.

The order is the earliest timestamp any of the Property's points resolves to, and then the order the story lists them. A Property with no resolved timestamp is listed after the ones that have one, still in story order.

Each row shows the statement, and selecting it opens the detail panel. Each span is shown as the service read it: the resolved timestamp, or the Event and the end it was read as together with the timestamp that end resolved to, or the reason it did not resolve. A range the service reports as ending before it starts says so. An `at` is labelled as an observation. An empty `when` is labelled as holding throughout, with no time recorded. The row does not say the Property is in force. That word belongs to the list below, which is at one time.

`caused_by` is a link that selects that Event.

The records view remains the place that shows a span exactly as stored. This view shows the reading.

## Assertions

Below the Properties are the Assertions whose `entity_ids` include this Entity, in the order the story lists them. Each row shows the statement, the other records the Assertion names, its spans as read, and `caused_by` in the same way as a Property. Selecting one opens the detail panel.

## In force across the story

A control lists the stretches of story time in which this Entity's in-force set stays the same. A stretch changes only where a resolved range bound of one of this Entity's Properties, or of an Assertion that names it, starts or ends. An Event that does not bound one of those statements is not a choice. An `at` observation is not a bound. A standing claim, an empty `when`, is in every stretch.

A range with a start and an end is three stretches when nothing else cuts them: before the start, from the start until the end, and from the end onward. A range with no end is two: before the start, and from the start onward. A gap between two ranges of the same statement is a stretch of its own, and the statement is absent there. Adjacent stretches whose statements are the same, unresolved marks included, are one stretch.

The writer picks one stretch. The view has no field for a timestamp that is not one of these bounds. The choice is `?at=` in the address, so it survives a reload. A stretch that begins at a resolved bound stores that bound's normalised timestamp. The stretch before every bound stores `before`. `?edge=` is not used. With no stretch chosen, the section says to pick one and does not list statements as in force.

The list has two groups, the Properties of this Entity and the Assertions that name it, in the order the service returned them. The line above the list names the stretch: before a timestamp, from one timestamp until another, from a timestamp onward, or at every time when the Entity has no resolved bound.

A statement with an unresolved comparison shows each one: which span, which bound, and the reason, which is the one the service returns. The service returns only this Entity's statements. A bound that does not resolve does not cut a stretch, so a statement included because of that bound is in every stretch, with the mark, unless another bound of the same range places the stretch outside it.

## What the view does not do

- It does not edit. Editing is planned, in the detail panel.
- It does not draw Events on an axis. That is the timeline. A `caused_by` link selects the Event, and the writer opens the timeline on that selection.
- It does not resolve a time point, and it does not decide what is in force. The service does both.
- It does not detect that two statements contradict. Both are shown when both are in force.
- It shows one Entity at a time.

## The sample

`samples/ensemble_story.json` is the sample for this view. It has several Entities whose Properties change over time and bear on each other through Assertions and shared Events. It contains:

- A Property that ends at the moment the next one starts, so only the new one is in force at that moment.
- Two claims whose ranges overlap, so both are in force together.
- A standing claim, an empty `when`.
- An observation, an `at` span, that is never in force.
- One Property with two ranges and a gap between them.
- A range with no recorded end, and a range with no recorded start.
- A bound that does not resolve, so the statement is in force and marked.
- An Assertion that names two Entities and a place, one that is only an observation, and one that holds across a period.
- An Event that two Entities share.

The view is checked by answering the four questions for that story from the screen, and then for `samples/sample_story.json`.

## How it is built

Two reads, both specified in [architecture/application.md](../architecture/application.md), both computed by the Story Bible layer with `resolve_point`:

- `GET /stories/{story_id}/statement-times` returns every Property and Assertion span resolved, in the same point shape as the Event times. The rows are drawn from this.
- `GET /stories/{story_id}/in-force-stretches` takes the Entity and returns the stretches, with the statements in force during each one. The list is drawn from this.
- `GET /stories/{story_id}/in-force` still answers a single query point. This view does not call it.

Which Entity is on screen, and the order of its Properties and which Assertions name it, are functions of the story and the statement times. They do not render. They have Vitest tests. The stretches are the service's.

The screen is a select for the Entity, a select for the stretch, and the lists. It is Mantine, and it adds no chart library.

## What stays open

- **A stricter overlap rule.** Question 26. It would replace this reading.
- **Several Entities at once.** One Entity is the first version. A second is added when a question here needs it.
- **A timestamp that is not a bound.** The stretches are the choices. A field for any other timestamp is deferred.
