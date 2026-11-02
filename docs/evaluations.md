# Evaluations

Version 2 had no repeatable way to tell whether a prompt or workflow change made the writing better. Version 3 treats that comparison as a product requirement. Linear DEF-52 and DEF-57 are the design issues. This document says what the first evals are for, in the build order from [build-sequence.md](build-sequence.md).

## What gets scored

| Target | When | Role |
| --- | --- | --- |
| Story arcs | Slice 4, as soon as the arc agent exists | Primary. This is the first workflow we will iterate on. |
| Characters and other generated entities | Slice 4 | Secondary. Later workflows will try to create more interesting characters, and those changes need a score too. |
| Story Bible overall | Slice 4 | A coarse check that the generated structure hangs together: references, coverage of the user's request, obvious internal clashes. |
| Prose | Slice 5 | Primary, alongside arcs, once a prose workflow exists. |
| Cost and latency | Recorded from the first agent run | Not a quality score. Stored on the same run so a quality gain can be seen next to its price. DEF-57. |

Plot structure in DEF-52 maps to arcs and the events they organize. "Story-bible updates" map to the entity and overall-bible checks. A full multi-scene story fixture is the eventual end-to-end case DEF-52 suggests. It is not the first fixture, because prose is slice 5.

## What a run must retain

A run is one execution of a named workflow against a named fixture.

- Fixture id and the user prompt or story description.
- Workflow name and version. A prompt change is a version change.
- Model id and the parameters that affect the output.
- The Story Bible before and after, or the created bible if it started empty.
- Scores per dimension, who or what produced them, and the rubric version.
- Model-call count, tokens, estimated cost, and elapsed time, broken down by workflow step when the workflow has steps.
- Links to the stored prompts and responses for that run.

Two runs can then be compared because they share a fixture and differ in workflow version or model. That is the gap version 2 left open.

## How scoring can work

The rubric details are still open. The first arc rubric only needs to be stable enough to rank two outputs of the same fixture. Likely dimensions, to be tightened when we see real outputs:

- Does the arc follow from the user's description?
- Is there a visible change across the arc, rather than a list of unrelated events?
- Are the entities it depends on present and specifically drawn?
- Are there internal contradictions the model itself can see?

LLM-as-judge is a reasonable way to score prose and arcs, and it brings its own drift. If we use it, the judge prompt is versioned the same way as the writer prompt, and a small set of runs gets a human score so we can see whether the judge moves with us. DEF-52 asks this and does not answer it. Slice 4 should not block on a perfect judge. It should block on storing the artifacts so a judge can be added and compared.

A custom runner is enough to start. Adopting an existing eval framework is an implementation choice inside slice 4, not a reason to delay the data we store. CI execution of evals is optional later. The first surface is a way to launch a fixture and read the comparison. DEF-52's "admin workflow" matches that.

## What we will not claim

A higher score on one fixture is evidence about that fixture. It becomes evidence about the workflow only after the same change is run on a set of fixtures. Slice 4 should start with more than one description, even if the set is small, so a prompt cannot be tuned to a single story without anyone noticing.
