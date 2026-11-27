# Future work

This is the work for after the proof of concept. [build-sequence.md](build-sequence.md) is the order the proof of concept is built in. Everything here waits until that is done, unless the owner pulls an item forward.

Nothing here is scheduled, and the items are in no order. An item is a note of intent, not a design. When the owner decides to build one, it moves into the build sequence, and the doc that owns its area is updated before any code changes.

An open question stays in [open-questions.md](open-questions.md). This doc points at the question by its number there and does not restate it.

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

These were never part of the proof of concept. The docs that own them already say they wait.

- **Hosted deployment on Railway.** The store interface is what makes hosting a deployment and not a new ownership model. Postgres, the bucket, encryption of the API key, and how a request authenticates are the hosted half of [architecture/persistence.md](architecture/persistence.md). The local app is the first runtime. The retention routine from [architecture/application.md](architecture/application.md) is built with hosting: locally the log has no cap, and the only rows the routine would clear are old heartbeats. Hosting needs the stores, the story endpoints, and the frontend. It needs nothing the agent, the evaluations, or prose add, so it can be pulled forward without reordering the build sequence. Question 10 is how a hosted request authenticates.
- **A workflow that survives a process restart.** A run lives in the process, and its durable artifact is the last successful commit. Question 6.
- **The Story Space location agent, routes, and time scrubber.** A location can be an Entity now. The writer and the arc agent edit locations directly until that project is pulled in. Question 7.
- **Candidate plot explorations and character-query interviews.** The arc chat reads through tools until then. Question 8.
- **How many conversations the workspace lists.** It can be added without reordering the build sequence. Question 1.
- **Story Bible revisions a story may need.** A stricter overlap rule, a fact-or-belief marker, richer Assertion references, a story-specific calendar, and looser Event times. Questions 2 to 5 and 9. Each is a revision to [story-bible.md](story-bible.md) if a story needs it.
