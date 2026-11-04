# Evaluations

This is how a prompt, model, or workflow change is judged, and what that run cost. The logging doc owns the call record. This doc cites those records. It does not capture a prompt a second way. The agents doc owns the arc chat this scores. The persistence doc owns the story commit and the call-log retention rule. This doc owns the fixture, the run, the scores, and the comparison.

## What is scored

| Target | When | What the score is about |
| --- | --- | --- |
| Story arcs | The first runs, as soon as the arc chat exists | Primary. Three dimensions on the arcs and their Events, in [The judge](#the-judge). |
| Story Bible construction | The same runs | The same three bible dimensions, with the wording fitted to entities, events, or assertions. |
| Prose | When a prose workflow exists | Three scene dimensions. The score shape below already has a place for them. |
| Cost and latency | Every run, from the first | Not a quality score. Stored on the same run, from the cited call records, so a gain sits next to its price. |

One run of the arc chat is judged on its arcs and on the bible it wrote. Scoring the second target does not mean running the fixture again.

Plot structure in the Linear evaluation issue is these arcs and the Events they organize. Story-bible updates are the construction scores. A dangling reference is not a judge dimension: a commit already refuses one, so a bible that saved has none. That rule is a check. A contradiction still saves, as the Story Bible doc says. An unintended clash is the judge's concern. A belief that conflicts with another belief, or a fact the brief left unspecified, is not a clash.

Every run also runs deterministic checks. Those checks call no model. They read the saved bible and the tool results, and they pass or fail. The first checks are tool-call validity and id handling, in [Checks](#checks). The judge does not repeat them. A structurally valid bible can still be a weak arc, and that split is the point of having both.

## The gap this closes

Version 2 stored every model call and had no repeatable comparison. A plot went through `plan_plot`: a nested tool loop that blocked the chat turn, allowed one write per message, and ran an intimacy interpretation on each write. That multiplied calls for a plot version 3 writes directly, on the arc chat, with no interpretation step. Those call counts are the problem the log could already show. This workflow records its own cost, in total and per step. It does not inherit a target from that loop.

A comparison here is two runs of one fixture. A prompt change is a workflow version change, so the pair can differ in version, in model, or in both.

## A fixture

A fixture is one task, stored as application data, scoped to the user who wrote it. It is not a story.

| Field | Role |
| --- | --- |
| `fixture_id` | Stable id. |
| `version` | Integer, starting at 1. |
| `user_id` | Owner. |
| `title` | Name shown in the list. |
| `starting_document` | A story document, or an empty one. |
| `messages` | The user turns, in order. |
| `note` | What this fixture is for. |

A version is immutable. Changing the description, the starting document, or a message inserts a new version. Old runs keep the version they used.

The first suite is ten fixtures, and it is a regression set rather than a benchmark. Five ask for arcs from an empty bible: a character change, a relationship, an external conflict, a mystery, and a subplot that is meant to stay unresolved. Five ask for Story Bible construction: a character, a location, relationships and assertions, an event together with a state update, and a change that has to stay consistent with facts already stored. The last two of those start from a document. The rest can start empty. The briefs leave some facts unspecified, and at least one allows a genuine conflict of belief, so a judge is not pushed to reward extra specification. Five scene fixtures join the suite when prose exists: dialogue, interpersonal conflict, introspection, action, and atmosphere. One description is not a suite. A prompt can be tuned to it and look improved. A full multi-scene story, the end-to-end case the Linear issue suggests, waits with that prose.

## A run

A run is one execution of a named workflow version against one fixture version. The runner uses the same agent the product uses. For the arc chat that is the `chat` node, the same base prompt, the same tools, and the same recursion limit. The runner does not add an instruction of its own.

It differs from a writing session in three ways. It creates a new story, owned by the launching user. An empty starting document is that story as `create` returns it. Any other starting document is one commit of that document, under the same rules as any commit. The runner does not write framing the fixture left empty. It creates a new conversation thread on that story and sends the fixture's messages in order, one invoke at a time. It mints a `workflow_run_id` and passes it on every invoke.

The logging context on those invokes is the owner's `user_id`, the new story's `story_id`, `workflow` `chat`, `node_id` `chat`, the resolved `config_id`, and that `workflow_run_id`. The interactive chat still leaves the workflow run id empty, because there the agent is the run. The logging doc is why the eval caller mints one: the calls of a multi-turn run are grouped by it.

The model is the user's saved selection for the node, unless the launch names a config. Naming a config does not change the saved selection. The caller resolves that config the way the model-configuration doc resolves any node, and builds the agent from that binding. The prefix on the binding applies, as on any other call.

| Field | Role |
| --- | --- |
| `eval_id` | This run's key. |
| `user_id` | Owner. The launching user. |
| `status` | `running`, then `success`, `error`, or `cancelled`. |
| `fixture_id`, `fixture_version` | The task. |
| `fixture_messages`, `starting_document` | The copy that was executed. |
| `workflow`, `workflow_version` | The workflow and the version string it published. The arc chat's workflow name is `chat`. |
| `base_prompt_hash` | SHA-256 of the base prompt's UTF-8 bytes, before the prefix. |
| `config_id`, `model`, `temperature`, `max_tokens`, `reasoning_effort`, `prefix_hash` | The resolved binding. `prefix_hash` is SHA-256 of the prefix's UTF-8 bytes, and of the empty string when the config has no prefix. |
| `story_id`, `thread_id` | The story and conversation created for the run. |
| `workflow_run_id` | The id passed to every invoke. The logging doc's grouping key. |
| `bible_before`, `bible_after` | Copies of the story document. The story store keeps no history, so the copy is the record. |
| `workflow_call_ids` | The model-call `call_id`s of this `workflow_run_id`. |
| `usage` | Totals and a per-step breakdown, read from those calls. Cost is the total and the cost of each step. |
| `price_snapshot` | The prices the cost estimate used. |
| `checks` | Pass or fail from the deterministic checks, written when the run finishes. |
| `scores` | The judge's scores. Empty until the judge has run. A person can add a score on the same dimension. |
| `instance_id`, `started_at`, `finished_at`, `duration_ms`, `error` | Wall clock from start to finish. `error` is the exception text. |

The version string is declared beside the base prompt. It changes when the base prompt or the tool behavior changes. The hash makes a prompt change visible when the string was not bumped. A tool change that forgets the bump is not something the hash can see. The string is the label a comparison uses.

`bible_before` is the document once the fixture's starting state is in place, and before the first message. `bible_after` is the document when the last invoke returns, including when the run then ends in error or is cancelled. A later edit to the live story does not change the copies. The story and the thread stay, so the result can be opened. They are ordinary rows. Whether the story list separates a run's story from stories the user started by hand waits with the views question in [open-questions.md](../open-questions.md). The comparison reads the copies.

Status is `success` when every message was sent and each invoke returned, `error` when an invoke raises, and `cancelled` when the operator stops the run. A stop uses the arc chat's cancel, at a superstep boundary. Commits that landed stay in the story and in `bible_after`. A run left `running` because the process died is shown as interrupted under the same instance rule as a call record. The stored status stays `running`.

Quality is not a status. A failed check does not change it. An unscored run is still a finished run.

## Checks

The runner writes the checks when the workflow returns, before the judge runs. A check reads `bible_after` and the tool records whose parent is one of the cited model calls. The logging doc defines that tool record. A check calls no model.

| Field | Role |
| --- | --- |
| `check_id` | Key, unique on the run. |
| `name` | The check. |
| `status` | `pass` or `fail`. |
| `detail` | What failed. Empty on a pass. |

Two checks run on every arc-chat run. Further checks of this same shape can be added without a new record.

`tool_calls` passes when every tool call the model requested names a tool that call offered, a success result matches a change actually stored, and no stored string contains a tool-call tag. The agents doc refuses leaked markup before the commit. This check is the run's record of that rule.

`id_handling` passes when an unknown id comes back as an error result that names the legal ids and stores nothing, a create's stored id is the id the tool returned rather than one the model supplied, and an update, a delete, or a reference names an id that existed. A reference in `bible_after` that does not resolve fails the check.

A tool error the model then corrects is a pass. The check is that the tool told the truth and the bible matches it. The check is not that the model's first attempt was perfect.

## The judge

The judge is comparative engineering feedback. It asks whether a change made this output more coherent, more faithful to the brief, or more effective, and which stage moved: the arcs, the Story Bible, or, later, the prose. It is not a measure of literary merit, and a small movement on the scale is not a conclusion. Rubric-guided scores can track some human judgments and still disagree with them. They are pulled by the order of the candidates, by length, and by a preference for the judge's own style. The useful result is a regression you can see in the notes, under the same fixtures, the same rubric version, and the same judge model.

Each category has three dimensions. They are scored independently, from 1 to 5. A strong impression on one does not raise the others. An aggregate is not stored. Dialogue, pacing, imagery, emotional impact, originality, and a general "interestingness" are not dimensions. One is added only when the suite keeps missing a failure those three do not catch. A reader's preference for which scene they would rather continue is a later experiment, kept separate from these scores, and it is not a reason to change the writer until it has been compared with a person's preference.

| Score | Meaning |
| --- | --- |
| 1 | Fundamentally unsuccessful. Serious problems. |
| 2 | Significant problems. Partially successful. |
| 3 | Adequate, and noticeably weak. |
| 4 | Good. Largely successful, with minor weaknesses. |
| 5 | Excellent. The criterion is met very well. |

There is no pass line. A score does not change the run's status.

Arcs, judged as a plan. The artifact is the arcs in `bible_after` and the Events they name. The brief is the fixture's messages. The context is `bible_before`.

| Dimension | Question |
| --- | --- |
| `coherence` | Do the developments form a comprehensible causal or psychological progression? |
| `structure` | Does the arc establish a starting situation, develop it, and reach an endpoint that fits the scope the brief asked for? |
| `narrative_effectiveness` | Does the arc develop the conflict, theme, relationship, or character change the brief asked for? |

An orderly list of Events is not, by that fact, an effective arc. An arc the brief left unresolved is not failed for lacking a final resolution. A structure that departs from a familiar shape is not failed when the brief asked for that departure.

Story Bible construction, judged as structured narrative data. The same three dimensions apply to entities, to events, and to assertions. The prompt names which of those the fixture asked for. Assertions relate entities. Properties stay on entities.

| Dimension | Question |
| --- | --- |
| `instruction_adherence` | Are the requested entities, properties, relationships, events, and details present in the form the brief asked for? |
| `internal_consistency` | Does the result avoid unintended contradictions with itself and with facts already stored? |
| `relevance_and_usefulness` | Is the information useful for the task the brief set, without inventions the brief did not ask for? |

An unspecified fact is not a defect unless the brief required it. Two beliefs that disagree are not an inconsistency when the story is allowed to hold both. The score is about faithfulness and usefulness, not about how much world was invented.

Prose, when that workflow exists, judged as a scene. The artifact is the scene text. The context is the brief and the bible material the scene was written from.

| Dimension | Question |
| --- | --- |
| `coherence` | Are the events, dialogue, actions, and transitions understandable and consistent with each other? |
| `prose_quality` | Is the prose clear, fluent, and in the tone and style the brief asked for? |
| `scene_effectiveness` | Does the scene do the narrative job the brief set, such as a conflict, a revelation, or an atmosphere? |

The scene is not required to have a conventional beginning, middle, and end. The question is whether it does the job it was given.

Each category is one structured call, a tool-less agent from the shared builder, on the registry node `judge`. Its default role is `judgment`. The model-configuration doc is why that node has to be registered before a selector is shown. An arc fixture is judged twice: once as arcs, once as the bible that run wrote. A bible fixture is judged as construction. A scene fixture is judged as prose. A comparison of writer versions holds the resolved judge config fixed: the same `config_id`, the same model, and the same rubric version. Scores made by two judge models do not line up. The judge's own prompt is a workflow version, the same rule as the writer's. Its calls use their own `workflow_run_id`, are cited on the scores, and stay out of the writer run's usage.

The call is given the fixture's messages, the prior story in `bible_before`, and the artifact for that category. For an arc, the artifact is the arcs, the Events they name, and the entities those Events name. For construction, it is the records the fixture asked for, as stored in `bible_after`. For prose, it is the scene text and the bible material the scene was written from. The call is not given the writer's model, the workflow version, or records the artifact does not depend on. The prompt carries the three questions, the scale, and these instructions. The wording is the prompt builder's. The obligations are these:

- Score the artifact as it was written, not a revision the judge wishes it were.
- Score it against the genre, style, purpose, and scope the brief asked for.
- Score each dimension on its own.
- Do not reward length, complexity, or extra detail.
- Accept ambiguity, partial specification, an unconventional shape, and tension the brief left unresolved.
- For each dimension, return the integer score and a short reason that names a concrete feature of the artifact.

The three scores and their reasons are the score rows for that category. The reason is the score's `note`. A score whose note does not match the artifact is not evidence, whatever the integer is.

Before a trend is treated as evidence, a person reads the judge's scores and notes for the suite, and for a few extra runs whose artifact was altered to contain a known fault: an arc missing a causal link, a scene whose actions contradict each other, an assertion that clashes with a stored fact. The judge's scores should move toward the fault, and the notes should name it. A person can store their own score on the same dimension. The suite is small enough that this review is the calibration. The rubric or the judge model changes only when that review shows a miss the dimensions cannot see. The change is a new rubric version, or a new judge config, and the old scores stay under the old one.

A pairwise pass is optional, and it does not replace the dimension scores. It takes two writer runs of the same fixture version, hides which version is which, and asks which artifact meets the brief better, whether that preference is decisive or a tie, and what concrete difference explains it. The runner asks twice, with the order reversed. When both orders pick the same run, the result stores that run's `eval_id`. When both call it a tie, the result is `tie`. When the orders disagree, the result is `uncertain`. The record cites both runs, the rubric version, the judge calls, and the reason. Wins, losses, ties, and uncertain pairs sit beside the dimension scores. They are not a second scale.

## Scores

A score is added to a finished run. Adding one does not change the bible copies, the checks, or the usage.

| Field | Role |
| --- | --- |
| `score_id` | Key, unique on the run. |
| `target` | `arc`, `bible`, or `prose`. |
| `subject` | Empty when the score is of the whole artifact, which is the usual case. A record id when the score is of one record. |
| `dimension` | A name from the rubric. |
| `rubric_id`, `rubric_version` | The rubric that defined the dimension and the scale. |
| `value` | An integer from 1 to 5. Empty only when a human scorer declined. |
| `source` | `judge` or `human`. |
| `note` | The judge's reason, naming a feature of the artifact. A human score may leave it empty. |
| `judge_call_ids` | The judge's model calls, when `source` is `judge`. Empty for a human score. |

`rubric_id` is the category, the same three values as `target`. `dimension` is one of that category's names. The launch runs the judge after the checks. A pairwise result is stored beside the runs it cites, not as a dimension score.

## Cost and latency

Usage is read from the cited model-call records, not from a second meter. The logging view's token rule is the rule here: prefer the assistant message's `usage_metadata`, and fall back to the provider usage field. Input, output, reasoning, and total are kept when present. A cached-input count is kept when that metadata separates it.

The breakdown has one row per step, which is the call's `node_id`, plus a total. The arc chat has one step, `chat`. Each attempt is its own call, including a retry and a call that ended in error. A row holds the call count, the token sums, the summed `duration_ms`, and the estimated cost. The total row is the run's cost. There is no budget, and a cost does not fail a run.

The run's own `duration_ms` is the wall clock from start to finish. It includes tool time and the gaps between turns. The breakdown's durations are model time only. Both are stored.

The stored usage is a reading of the cited records. A comparison may recompute the tokens and the durations from those records. If the two disagree, the records win. Cost cannot be recomputed from the records alone, because a call record has no price. The price snapshot is the authority for the estimate: one entry per model id that appeared, with USD per million input tokens, per million output tokens, an optional cached-input price, and the date the runner took the numbers. Where the runner reads the price is the runner's choice. The snapshot is what the run used.

Cached input uses the cached price when the snapshot has one. Otherwise those tokens are priced as input, and the cached count is still on the row. Reasoning tokens that are already inside the output count are not priced again. A model with no snapshot entry leaves estimated cost empty. Tokens and latency are still stored.

That is the comparison across providers. Money is this estimate. Token counts stay the provider's counts. Two models are compared on those figures.

A call still `running`, or a call with no usage, counts in the call count. Its missing token and duration fields are skipped, not stored as zero.

Optional exploration, once it exists, is another step in this breakdown. A run that explored and a run that did not are comparable, and the extra cost sits on that step. The arc chat has no such step.

## Comparison

A comparison is two or more runs with the same `fixture_id` and the same `fixture_version`. The view lines up the workflow version, the base-prompt hash, the resolved model and sampling, the prefix hash, the status, the bible copies, the checks, the scores, and the usage, including the total cost and the cost of each step.

A check lines up with another by name. A score lines up with another only when the target, the subject, the dimension, the rubric version, and the judge model match. A missing score is unscored. It is not a zero. The view shows the dimension scores and their notes. It does not collapse them into one number, and it does not pick a winner. A small gap on the 1–5 scale is a reason to read the notes, not a result by itself.

Several runs of the same version and the same model are how variance shows. A median across them is a view over these records, not a new record.

A higher score on one fixture is evidence about that fixture. It is evidence about the workflow only when the same change is run on the fixture set.

The cited model calls are where the prompt and the response are read, including the prefix and the base prompt, and where the tool calls the model requested are read. The tool records are where the checks read what the tool returned.

## Where a run is stored

Fixtures and runs are rows in the application database: `data/app.sqlite` locally, Postgres on Railway, in the place the persistence doc reserved. They are scoped by `user_id`. They are not part of a story, and they are not in a story export. The bible copies are the story document, the same JSON the story row holds. Slice 4 has no eval blob, and it does not use the bucket. Prompts stay in the call log.

| Operation | Role |
| --- | --- |
| `put_fixture`, `get_fixture`, `list_fixtures` | A new fixture, or a new version of one. An existing version is not overwritten. |
| `start_run` | Insert `running`, with the fixture copy, the version, the binding, `bible_before`, and the `workflow_run_id`. |
| `finish_run` | Status, `bible_after`, `workflow_call_ids`, usage, the price snapshot, and the checks. |
| `add_score` | Append a score. Judge call ids join the cited set. |
| `add_pair` | Store an optional pairwise result that cites two runs. Its judge call ids join the cited set. |
| `get_run`, `list_runs` | Newest first. Filters include the fixture, the workflow version, and the model. |
| `cited_call_ids` | The union of `workflow_call_ids`, score `judge_call_ids`, and pairwise judge call ids. With a user id, that user's runs. With none, every run, which is what the age job reads. |

The persistence doc's deletion routine asks `cited_call_ids` and excludes those records. This doc does not add a second retention rule. Deleting a run drops its citations. A call another run still cites stays. Deleting the story or the thread does not delete the run.

The runner writes this record itself. A library may replace that runner only if it stores this same record and still cites the call log. The architecture does not depend on one.

## The first surface

The user launches a fixture against a workflow version and a model config, then reads the comparison. That launch runs the workflow, the checks, and the judge. That user is the owner of the run. There is no separate admin role. The screen follows the UI choice that is still open. This doc says what the surface does, and not which framework draws it.

Evaluations do not run in CI.

## What stays open

The judge rubric, the scale, and the suite are the ones in this doc. Whether the story list separates a run's story from stories the user started by hand stays with the views question in [open-questions.md](../open-questions.md).
