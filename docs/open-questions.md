# Open questions

These are the decisions the working docs have not closed. Settled items stay here so a later step does not reopen them. Each open item names the doc that will close it.

## Settled

Items 1–4 are stated in [vision.md](vision.md) and come from the decisions in [README.md](README.md). Items 5 and 6 are stated in [story-bible.md](story-bible.md). Item 7 is stated in [architecture/model-configuration.md](architecture/model-configuration.md). Items 8–11 are stated in [architecture/persistence.md](architecture/persistence.md).

1. **This repository is the build.** The Linear project text described itself as architecture-only. Implementation follows these docs.
2. **The build order is the Story Bible, then light editing and visualization, then an arc-planning chat agent, then evaluations, then prose.** Prose stays out until then.
3. **Railway is the hosted target, after a local-first implementation.** Each story has an owner.
4. **Story Space stays out of the first slices.** Location entities can exist in the bible. The location agent, routes, and time scrubber stay in that project until a later decision pulls them in.
5. **Slice 1 implements the model in [story-bible.md](story-bible.md).** That is Draft 2, with story framing stored on the story, readable frozen ids, and dangling references refused. Intimacy replay, signals, and derived ranks are out. A belief is a Property or an Assertion.
6. **There is no Event-link record.** A cause, an order, or any other relationship between Events is an Assertion that names those Events. Story time is the span list on an Event. Version 2's `follows`, `directly_follows`, `depends_on`, and `during` are not a vocabulary in this model.
7. **Each user has their own model configs.** They are separate from that user's stories and are not part of a story export. The user provides their own OpenRouter API key through the UI. The key is not a field on a config and is not included in a config export or a story export.
8. **Local structured data is SQLite. Hosted structured data is Postgres.** Object storage is for blobs once they exist. Callers use the store interfaces. A JSON file under a process lock is not the slice 1 design.
9. **A conversation is a LangGraph thread with an owned row for one user and one story.** The chat agent's checkpointer holds the transcript; the row is the scope. It is not a Story Bible record, and it is not in the story export. The store allows more than one conversation per story.
10. **The user's API key is in the secrets store.** It is not in the config document, a story export, a config export, or the call log. On Railway the application encrypts it before writing.
11. **Call-log retention does not delete a record an evaluation run cites.** The local log has no cap. On Railway, uncited records older than 90 days may be deleted.

## Slice 2

12. **What is the UI?** React is an open candidate. A Python API with a separate frontend matches later deployment. A thinner Python UI is still possible. NiceGUI is the option the briefing set aside. The architecture overview records this as still open if no earlier doc chooses.
13. **Which views are the minimum?** [story-bible.md](story-bible.md) requires Events in story time, editable when selected, and Arcs laid over those Events. The suggested set also includes an entity editor and an assertion view. Confirm before building extra graph types. The build sequence names the slice.

## Slice 3

14. **Does the arc agent write bible records directly, or does it write an intermediate plan that a second step converts?** DEF-54 leaves markdown, structured data, or a hybrid open. The agents doc closes this.
15. **What is the planning unit?** A whole story from one prompt, or a bounded section the user names? The first demo can be "one description produces a small set of arcs." Larger stories need a unit. The agents doc closes this.
16. **Do candidate explorations and character interviews wait?** DEF-55. [vision.md](vision.md) says they wait until the arc workflow exists. The agents doc confirms or revises that.
17. **Does the writer see an arc draft before it is saved?** The commit can stay one choke point either way. [vision.md](vision.md) leaves this open. The agents doc closes it.

## Slice 4

18. **Custom eval runner or an existing framework?** Either can sit on the run record in [evaluations.md](evaluations.md). The record is the decision that matters first. The evaluations doc closes this.
19. **What are the first rubrics, and does a model judge them?** Human scores on a few fixtures are the calibration set if a judge is used. The evaluations doc closes this.
20. **What concrete cost and latency numbers count as success?** DEF-57. Better to set them after a handful of arc runs than to invent them now. The evaluations doc closes this.

## If slice 1 needs a narrower reading of story time

21. **Does a stricter overlap rule replace the in-force view?** [story-bible.md](story-bible.md) already defines the slice 1 reading. An empty `when` is included at every query point. A `range` with no `end` still applies after its `start`. Separate ranges do not fill the gaps between them. An `at` span does not put a statement in force. An unresolved comparison is marked and the statement is still included. A contradiction warns without blocking the save. A later rule may tighten that view. It must not add a record type or a field beside `when`. Revise the in-force section of [story-bible.md](story-bible.md) when a story needs the tighter rule.

## Later

22. **Do statements gain a marker for objective fact, belief, or plan?** Slice 1 has no such marker. A belief is a Property or an Assertion. Adding a marker later must not block a writer's edit. Close this in [story-bible.md](story-bible.md) if a story needs the distinction.
23. **Do Assertion references need roles, and should Properties ever link to other Properties?** Slice 1 does neither, and a change does not propagate on its own. Close this in [story-bible.md](story-bible.md) if that becomes necessary.
24. **When does a workflow need to survive a process restart?** [architecture/persistence.md](architecture/persistence.md) says an early run lives in the process, and the durable artifact is the last successful story transaction. Checkpoint, resume, and a run that must continue after a crash stay open. DEF-51. The persistence doc revises this when that is needed.
25. **Field-level authority for locations**, once Story Space is integrated. DEF-78 and DEF-80. Stays deferred with that project.
26. **How does a later research step select and compress Story Bible context?** DEF-56 leaves retrieval, an exploring agent, or a hybrid open, along with what the bundle contains and how relevance is chosen. [architecture/prompt-assembly.md](architecture/prompt-assembly.md) already requires that synthesized text stay distinguishable from a stored statement. That doc revises this when the step is designed. The agents doc shares it if the planner's use of the bundle needs a decision.
27. **Does the debug log also record tool results?** [architecture/llm-debug-logging.md](architecture/llm-debug-logging.md) records the tool calls the model requested, and leaves room for a `tool_call` record with the tool's result or error. That doc closes this when an evaluation needs the tool results.
28. **How does a hosted request authenticate as a user?** [architecture/persistence.md](architecture/persistence.md) requires a user id on every store call and makes ownership an authorization check. Locally there is one implicit user. How a hosted request proves who it is goes with the UI and API decision in question 12. The architecture overview records the choice when it is made.
