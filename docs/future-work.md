# Future work

This is the work for after the proof of concept. [build-sequence.md](build-sequence.md) is the order the proof of concept is built in. Everything here waits until that is done, unless the owner pulls an item forward.

Nothing here is scheduled, and the items are in no order. An item is a note of intent, not a design. When the owner decides to build one, it moves into the build sequence, and the doc that owns its area is updated before any code changes.

A decision the proof of concept has to make is in [open-questions.md](open-questions.md). A decision that can wait is kept here, with the work it belongs to, and is made when that work is designed.

## The graph

The graph in [ui/graph.md](ui/graph.md) is built, and it answers its first two questions on the small sample stories. Two pieces of work on it are not finished.

### A large story that reads well

`samples/large_story.json` has about 180 records and 460 references, and the graph of it is hard to read. Part of the work is built: a layout that places one story the same way on every load, each Entity drawn in a box with its Properties, forces set by kind, the layout panel that tunes them, and the screenshot command that lets two layouts be compared from images.

What is left:

- An isolated group of five to ten records in the large sample, which connect to each other and to nothing else, so the question about isolated groups can be judged for a group and not only for a single record.
- The layout changes not yet chosen. "What stays open" in the graph doc lists the candidates: Narrative Units drawn inside their parent unit, and quieter lines. The owner chooses from screenshots, and a choice is written into the graph doc before it is built.
- Where the layout panel goes once the layout is settled. It is a development tool, and it is on the graph's screen only while the layout is being tuned.

The work is done when the graph doc's questions 1 and 2 can be answered from the screen on the large sample.

### Search and focus

Finding the records that mention some text, and narrowing the graph to the records around one record or one Arc, to what an Arc depends on, or to what depends on a record. These answer the graph doc's questions 3 to 6. Neither is designed. The design is added to the graph doc before it is built.

The graph doc also records two ideas for its questions 7 and 8: showing only the connections between two Entities, and measures of an Entity's reach.

## What the docs already say waits

These were never part of the proof of concept. The docs that own them already say they wait. Where an item has a decision still to make, the item says so.

- **Hosted deployment on Railway.** The store interface is what makes hosting a deployment and not a new ownership model. Postgres, the bucket, encryption of the API key, and how a request authenticates are the hosted half of [architecture/persistence.md](architecture/persistence.md). The local app is the first runtime. The retention routine from [architecture/application.md](architecture/application.md) is built with hosting: locally the log has no cap, and the only rows the routine would clear are old heartbeats. Hosting needs the stores, the story endpoints, and the frontend. It needs nothing the agent, the evaluations, or prose add, so it can be pulled forward without reordering the build sequence. Still to decide: how a hosted request proves who it is from. The API already resolves every request to a user id at its edge, and locally that is the one implicit user. The hosted mechanism is an adapter behind that step, as the application doc says, and it does not change the ownership model.
- **A workflow that survives a process restart.** A run lives in the process, and its durable artifact is the last successful commit. A turn has a durable row and a task that is not durable, and a turn whose process died is shown as interrupted. Nothing in the proof of concept needs more than that. Checkpointing a run and resuming it after a crash would be built on the turn row, and it is the condition under which a separate worker becomes worth having. [architecture/persistence.md](architecture/persistence.md) and [architecture/application.md](architecture/application.md) are revised when a workflow needs it.
- **The Story Space location agent, routes, and time scrubber.** A location can be an Entity now. The writer and the arc agent edit locations directly until that project is pulled in. Still to decide when it is: which fields of a location that project owns.
- **Candidate plot explorations and character-query interviews.** The arc chat reads through tools until then. [architecture/agents.md](architecture/agents.md) already fixes that a candidate is not canon until it is adopted, and that a character query is a read whose answer is not stored. Still to decide for candidates: how many directions, how they are produced and ranked, and whether exploration runs only when asked. Still to decide for a character query: exactly what a character can know at a story point.
- **Listing a story's earlier conversations.** The chat panel shows the story's latest conversation and can start a new one, as the agents doc says. The store keeps the earlier ones. A list of them, and reopening one, can be added without reordering the build sequence.

## Story Bible revisions a story may need

None of these is planned. Each is a revision to [story-bible.md](story-bible.md), made if a story needs it.

- **A stricter overlap rule for what is in force.** The Story Bible doc defines the current reading, and it is built. A later rule may tighten it. It must not add a record type or a field beside `when`.
- **A marker for objective fact, belief, or plan.** The model has none. A belief is a Property or an Assertion. Adding a marker must not block a writer's edit.
- **Roles on an Assertion's references.** An Assertion names its participants in id lists, and the sentence says what each is to the others. A role on each reference is added only if that stops being enough.
- **One statement pointing at another.** Properties and Assertions do not point at other statements, and a change does not propagate on its own. `supersedes`, which named the statement a new one replaced, was removed: how one claim replaces another needs more thought, and the spans are what say when a claim holds. The entities view shows why a claim changed from `caused_by`, and what holds when from the spans, so no link has been needed so far.
- **A story's own calendar.** A timestamp is an ISO 8601 value in a nominal Gregorian calendar. A story with its own month names and lengths, or with years outside `0001` to `9999`, would get a new kind of time point beside the timestamp and the Event id, inside the existing `when` list. No record gains a field.
- **An Event at an unknown moment inside a window.** A `range` is a period the Event lasts for, so a `when` list cannot say that an Event happens once at some moment between two bounds. The owner wants this eventually. It would be a new kind of span in the `when` list, with no new field on any record. Until then the timeline draws only what the model stores. The other looser record, an Event placed only as before or after another, is needed sooner. It is question 1 in [open-questions.md](open-questions.md).
