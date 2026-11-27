# Open questions

These are the decisions the docs have not closed. Each one names the doc that will close it.

A decision that has been made is not kept here. It is stated in the doc that owns its area, with the reason where the reason matters, and the question is removed from this list. [architecture.md](architecture.md) maps each part of the system to its doc.

The other docs name a question by its number in this list. When a question is removed and the numbers after it change, the references change with them.

Work that waits until after the proof of concept is in [future-work.md](future-work.md).

## The arc chat

1. **Does the workspace list more than one conversation per story?** The store allows more than one. The agent runs on the conversation it was given. [architecture/agents.md](architecture/agents.md) leaves the list to the frontend, over the conversations endpoint in [architecture/application.md](architecture/application.md).

## If a story needs a narrower reading of story time

2. **Does a stricter overlap rule replace the in-force view?** [story-bible.md](story-bible.md) already defines the current reading. An empty `when` is included at every query point. A `range` with no `end` still applies after its `start`. Separate ranges do not fill the gaps between them. An `at` span does not put a statement in force. An unresolved comparison is marked and the statement is still included. Two statements that contradict both save; nothing detects the contradiction. A later rule may tighten that view. It must not add a record type or a field beside `when`. Revise the in-force section of [story-bible.md](story-bible.md) when a story needs the tighter rule.

## Later

3. **Do statements gain a marker for objective fact, belief, or plan?** The model has no such marker. A belief is a Property or an Assertion. Adding a marker later must not block a writer's edit. Close this in [story-bible.md](story-bible.md) if a story needs the distinction.
4. **Do Assertion references need roles, and should one statement point at another?** Properties and Assertions do not point at other statements, and a change does not propagate on its own. `supersedes`, which named the statement a new one replaced, was removed: how one claim replaces another needs more thought, and the spans are what say when a claim holds. Close this in [story-bible.md](story-bible.md) if a link or a role becomes necessary.
5. **Does a story ever need its own calendar?** [story-bible.md](story-bible.md) fixes the timestamp as an ISO 8601 value in a nominal Gregorian calendar. A story with its own month names and lengths, or years outside `0001`–`9999`, would get a new kind of time point beside the timestamp and the Event id, inside the existing `when` list. No record gains a field. Close this in [story-bible.md](story-bible.md) if a story needs it.
6. **When does a workflow need to survive a process restart?** [architecture/persistence.md](architecture/persistence.md) says an early run lives in the process, and the durable artifact is the last successful story transaction. [architecture/application.md](architecture/application.md) gives a turn a durable row and a non-durable task, and keeps the task in the service process; a resume would be built on that row, and it is the condition under which a worker becomes worth having. Checkpoint, resume, and a run that must continue after a crash stay open. The persistence doc and the application doc revise this when that is needed.
7. **Field-level authority for locations**, once Story Space is integrated. Stays deferred with that project.
8. **How many candidates, and what may a character query know?** [architecture/agents.md](architecture/agents.md) says both wait, that a candidate is not canon until it is adopted, and that a character query is an unstored read. How many directions, how they are produced and ranked, whether exploration runs only when asked, and the exact knowledge boundary stay open. That doc closes them when the features are designed.
9. **Can an Event's time be recorded more loosely than a span allows?** A `when` list can say that an Event happens at a moment, at several moments, or across a period whose bounds may be unknown, and an empty list says no time was recorded. It cannot say that an Event happens once at some unknown moment inside a window, because a `range` is a period the Event lasts for. It cannot say that an Event comes before or after another without giving a time; an Assertion can state that order, and nothing reads an Assertion as story time. The owner wants both eventually. Each would be a new kind of span in the `when` list, which [story-bible.md](story-bible.md) already allows without a new field on any record. Until then the timeline draws only what the model stores. Close this in [story-bible.md](story-bible.md) when a story needs it.
10. **How does a hosted request authenticate as a user?** [architecture/persistence.md](architecture/persistence.md) requires a user id on every store call and makes ownership an authorization check. [architecture/application.md](architecture/application.md) fixes where that happens: the API resolves every request to a user id before any store or agent is touched, and locally that resolution returns the one implicit user. The mechanism a hosted deployment uses to prove who the request is from stays open, as an adapter behind that step. That doc records the step now and the mechanism when hosting is built.
