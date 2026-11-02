# Open questions

These are the decisions the working docs did not close. The ones at the top change the review. The rest can wait until the slice that needs them.

## For this review

1. **Is this repository the implementation project?** Linear `P-DEF-6` says the project is architecture only, and that implementation is a separate plan afterward. The working docs treat this repo as the build and treat the Linear issues as the design backlog. Confirm or correct that.
2. **Is the build sequence right?** Model, light editing and visualization, arc-planning chat agent, evals for arcs and entities, then prose and prose evals. Prose stays out until then.
3. **Is Railway the hosted target, with local-first until then?** The Linear storage issue says Postgres and object storage. It does not say Railway, and it does not say Google Cloud.
4. **Does Story Space stay out of the first slices?** Location entities can exist in the bible. The location agent, routes, and time scrubber stay in their own Linear project until we pull them in.
5. **Is Draft 2 the model slice 1 should implement?** Including the choice to drop intimacy replay and signals from the core. Beliefs would be ordinary statements if we need them.

## Slice 2

6. **What is the UI?** React is an open candidate. A Python API with a separate frontend matches later deployment. A thinner Python UI is still possible. NiceGUI is the option the briefing set aside.
7. **Which views are the minimum?** Suggested set: entity list and editor, assertion/relationship view, arc view that shows the events in each arc. Confirm before building extra graph types.

## Slice 3

8. **Does the arc agent write bible records directly, or does it write an intermediate plan that a second step converts?** DEF-54 leaves markdown, structured data, or a hybrid open.
9. **What is the planning unit?** A whole story from one prompt, or a bounded section the user names? The first demo can be "one description produces a small set of arcs." Larger stories need a unit.
10. **Do candidate explorations and character interviews wait?** DEF-55. The working docs say yes.

## Slice 4

11. **Custom eval runner or an existing framework?** Either can sit on the run record in [evaluations.md](evaluations.md). The record is the decision that matters first.
12. **What are the first rubrics, and does a model judge them?** Human scores on a few fixtures are the calibration set if a judge is used.
13. **What concrete cost and latency numbers count as success?** DEF-57. Better to set them after a handful of arc runs than to invent them now.

## Storage and concurrency, if slice 1 needs a narrower answer

14. **Local store behind the transaction interface:** SQLite, or JSON files with a revision. Postgres remains the hosted store. The working docs allow either local option.
15. **Overlap rules for statement validity.** Draft 2 defers them. Slice 1 can store the fields and use a simple view: a statement with no `valid_until` still applies after `valid_from`. Contradiction detection can warn and still save.

## Later

16. **Which event-to-event relation types survive?** Version 2 had `follows`, `directly_follows`, `depends_on`, and `during`.
17. **Do character interpretations remain stored anywhere?** DEF-53. Default in these docs: not in the core model.
18. **When does workflow durability matter?** DEF-51. In-process runs are enough until a workflow must resume after a crash.
19. **Does chat history belong to the story?** Version 2 kept it in a side file and left it out of export.
20. **Field-level authority for locations**, once Story Space is integrated. DEF-78 and DEF-80.
