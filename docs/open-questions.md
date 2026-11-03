# Open questions

These are the decisions the working docs have not closed. Settled items stay here so a later step does not reopen them. Each open item names the doc that will close it.

## Settled

Items 1–4 are stated in [vision.md](vision.md) and come from the decisions in [README.md](README.md). Items 5 and 6 are stated in [story-bible.md](story-bible.md).

1. **This repository is the build.** The Linear project text described itself as architecture-only. Implementation follows these docs.
2. **The build order is the Story Bible, then light editing and visualization, then an arc-planning chat agent, then evaluations, then prose.** Prose stays out until then.
3. **Railway is the hosted target, after a local-first implementation.** Each story has an owner.
4. **Story Space stays out of the first slices.** Location entities can exist in the bible. The location agent, routes, and time scrubber stay in that project until a later decision pulls them in.
5. **Slice 1 implements the model in [story-bible.md](story-bible.md).** That is Draft 2, with story framing stored on the story, readable frozen ids, and dangling references refused. Intimacy replay, signals, and derived ranks are out. A belief is a Property or an Assertion.
6. **There is no Event-link record.** A cause, an order, or any other relationship between Events is an Assertion that names those Events. Story time is the span list on an Event. Version 2's `follows`, `directly_follows`, `depends_on`, and `during` are not a vocabulary in this model.

## Slice 2

7. **What is the UI?** React is an open candidate. A Python API with a separate frontend matches later deployment. A thinner Python UI is still possible. NiceGUI is the option the briefing set aside. The architecture overview records this as still open if no earlier doc chooses.
8. **Which views are the minimum?** [story-bible.md](story-bible.md) requires Events in story time, editable when selected, and Arcs laid over those Events. The suggested set also includes an entity editor and an assertion view. Confirm before building extra graph types. The build sequence names the slice.

## Slice 3

9. **Does the arc agent write bible records directly, or does it write an intermediate plan that a second step converts?** DEF-54 leaves markdown, structured data, or a hybrid open. The agents doc closes this.
10. **What is the planning unit?** A whole story from one prompt, or a bounded section the user names? The first demo can be "one description produces a small set of arcs." Larger stories need a unit. The agents doc closes this.
11. **Do candidate explorations and character interviews wait?** DEF-55. [vision.md](vision.md) says they wait until the arc workflow exists. The agents doc confirms or revises that.
12. **Does the writer see an arc draft before it is saved?** The commit can stay one choke point either way. [vision.md](vision.md) leaves this open. The agents doc closes it.

## Slice 4

13. **Custom eval runner or an existing framework?** Either can sit on the run record in [evaluations.md](evaluations.md). The record is the decision that matters first. The evaluations doc closes this.
14. **What are the first rubrics, and does a model judge them?** Human scores on a few fixtures are the calibration set if a judge is used. The evaluations doc closes this.
15. **What concrete cost and latency numbers count as success?** DEF-57. Better to set them after a handful of arc runs than to invent them now. The evaluations doc closes this.

## Storage and concurrency, if slice 1 needs a narrower answer

16. **Local store behind the transaction interface:** SQLite, or JSON files with a revision. Postgres remains the hosted store. The working docs allow either local option. The persistence doc closes this.
17. **Does a stricter overlap rule replace the in-force view?** [story-bible.md](story-bible.md) already defines the slice 1 reading. An empty `when` is included at every query point. A `range` with no `end` still applies after its `start`. Separate ranges do not fill the gaps between them. An `at` span does not put a statement in force. An unresolved comparison is marked and the statement is still included. A contradiction warns without blocking the save. A later rule may tighten that view. It must not add a record type or a field beside `when`. Revise the in-force section of [story-bible.md](story-bible.md) when a story needs the tighter rule.

## Later

18. **Do statements gain a marker for objective fact, belief, or plan?** Slice 1 has no such marker. A belief is a Property or an Assertion. Adding a marker later must not block a writer's edit. Close this in [story-bible.md](story-bible.md) if a story needs the distinction.
19. **Do Assertion references need roles, and should Properties ever link to other Properties?** Slice 1 does neither, and a change does not propagate on its own. Close this in [story-bible.md](story-bible.md) if that becomes necessary.
20. **When does workflow durability matter?** DEF-51. In-process runs are enough until a workflow must resume after a crash. The persistence doc closes this.
21. **Does chat history belong to the story?** Version 2 kept it in a side file and left it out of export. The persistence doc closes this.
22. **Field-level authority for locations**, once Story Space is integrated. DEF-78 and DEF-80. Stays deferred with that project.
