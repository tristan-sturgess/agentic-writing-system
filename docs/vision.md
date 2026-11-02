# Vision

A creative writing system for fictional stories. The user describes the story they want. Agents do most of the work of turning that description into a Story Bible and, eventually, into polished prose. The user can inspect every part of that bible, edit it directly, and steer the agents with further prompts.

The product name in these docs is the Creative Writing System. Version 2 was framed as a writing assistant. Version 3 is a system: the Story Bible is the shared object, and both the user and the agents work on it.

## The Story Bible is the center

The Story Bible is the structured representation of the fictional world and the narrative. It holds characters and other entities, their properties, the relationships between them, the events of the story, the arcs that give those events narrative shape, and, later, the prose that presents them.

The application exposes that model in two directions:

- **To the user**, as visualizations and editing tools. The user should be able to see the shape of the story and change it by hand: define a character, revise an arc, correct a relationship, override anything an agent wrote.
- **To agents**, as tools and workflows. The intended path is that agents populate and revise the model. Manual editing is always available. It is not the primary way the story is supposed to get written.

User authority wins on content. Structural integrity can reject a broken reference. A quality check must not block a user edit. Agents follow tighter rules: concise statements, no silent rewriting of an existing claim to mean something new, and in-world change recorded as a new statement with a temporal link. That split is specified in [Story Bible Data Model Draft 2](v3-concept/story-bible-data-model-draft-2.md) and carried into [story-bible.md](story-bible.md).

## How a story gets made

The ideal run starts with a description of the kind of story the user wants. Agents then:

1. Create the relevant entities and their properties and relationships.
2. Propose story arcs.
3. Refine those arcs with the user.
4. Write the prose.
5. Deliver a polished story.

In practice the path is a revision loop. The user describes what they want. An agent creates the first entities. The user fine-tunes them by hand or with another prompt. Arcs get proposed, inspected, and revised. Prose comes after the arcs are good enough to evaluate. The system should make that loop cheap to repeat.

## What version 3 is optimizing for

Version 2 could update a prompt or a workflow and leave no trustworthy way to tell whether the stories got better. Version 3 keeps measurement next to the work. A change to a prompt, a model, or a workflow should be comparable to the previous run on the same kind of task.

The things that matter most to measure are **story arcs** and **prose**. Characters, other generated entities, and the Story Bible as a whole are also worth evaluating, because later workflows will spend real effort on them.

Version 3 also aims to plan stories more directly than version 2 did. Version 2 determined a lot of plot movement by replaying character interpretations and intimacy signals. That was expensive, and it made the plot a side effect of simulation. The version 3 direction is a lighter event graph, with the planning agent in control of narrative structure, and deeper character or world reasoning used only when a step actually needs it. See [architecture-direction.md](architecture-direction.md).

## What has to be true before agents start writing

Two constraints come from version 2 and apply before the first agent workflow:

- **Concurrent updates to the Story Bible have to be safe.** Parallel tool calls in version 2 raced, referenced objects that did not exist yet, and could leave memory and disk disagreeing. Version 3 plans the write model first. See [deployment-and-concurrency.md](deployment-and-concurrency.md).
- **It runs locally first, and it is shaped so it can later run on Railway for more than one user.** The first milestone is a local app. The data model still has an owner and a story boundary, so multi-tenancy is not a later rewrite of every record.

## What this version is not trying to do first

Prose generation waits until arcs can be created, edited, visualized, and evaluated. The physical-space subsystem in the related Story Space & Timeline project waits as well. Full simulation of character psychology is not the core of the model.
