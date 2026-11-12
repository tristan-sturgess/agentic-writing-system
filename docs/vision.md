# Vision

The Creative Writing System is a workspace for writing fiction. A writer describes the story they want. Agents do most of the work of turning that description into a Story Bible and, later, into prose. The writer can inspect every part of that bible, change it by hand, and steer the agents with another prompt.

The Story Bible is the shared object. It holds the fictional world and the narrative: the people and other entities, what is true about them, how they relate, the events, the arcs that give those events a shape, and, once prose exists, the narrative units that present them. [story-bible.md](story-bible.md) is the authority for what those objects are and how a writer's edit differs from an agent's.

This version is the product. It runs on the writer's machine first. Each story has an owner, so a later hosted deployment on Railway can hold many writers' stories without inventing a new meaning for a story. Storage, tenancy, and concurrent writes are specified in the persistence doc.

## Who it is for

It is for a writer of long-form fiction who wants the world, the plot, and eventually the prose in one workspace. The writer asks for changes in chat. The Story Bible remains the record of the story.

Hosting is there so each writer can keep their own stories. A story has one owner.

## How a writing session goes

The writer starts with a description of the story they want.

An agent turns that description into Story Bible records: entities, their properties, the relationships among them, the events, and the arcs. The writer reads that structure, edits it directly, or asks for a revision. That loop repeats until the arcs are worth keeping.

Prose comes after the arcs. The same loop applies once a prose workflow exists: the agent drafts, the writer revises by hand or with a prompt, and the bible stays the source the draft has to agree with.

The end people want is a polished story. The ordinary path is many revisions. A revision should be cheap to ask for and easy to inspect. The writer can see what each prompt changed in the bible and put a change back the way it was. The persistence doc specifies that history.

## What the writer can rely on

The writer can see the story's structure and change it. A writer's edit stands, including wording that is unconventional or poorly formed. A check can refuse a broken reference. A quality opinion must not block the edit. Agents work under tighter rules: they add and revise through the model, and they do not quietly change an existing claim so that it means something new. The Story Bible doc specifies that split.

The writer chooses the models the agents use. How a choice is stored, and how a standing instruction rides along with that model, belongs to the model-configuration doc.

The writer and an agent can both change a story. Those writes land in order, and a failed save does not leave the screen and the stored story disagreeing. That is a requirement of the first agent workflow. The persistence doc specifies the mechanism.

A change to a prompt, a model, or a workflow should be comparable to the previous run on the same task, including whether the result got better and what it cost in tokens, money, and time. Version 2 could not answer that. This version treats the answer as part of the product. Arcs are the first thing to measure. Characters, other generated entities, and the bible as a whole are measured too. Prose is measured once prose exists. The [evaluations doc](architecture/evaluations.md) specifies the run record.

## What ships in what order

The build follows the order a writer would notice. [build-sequence.md](build-sequence.md) is the authority for the slices and their dependencies.

1. The Story Bible, plus enough editing and visualization to inspect and correct it. The first pictures are events in time, and arcs across those events.
2. A chat agent whose job is to turn a description into arcs and the bible records those arcs need. The writer can edit between prompts.
3. Evaluations for those arcs, then for characters and other generated entities, and for the bible as a whole.
4. The prose workflow, and evaluations for prose.

Prose stays out until the earlier slices exist.

The interface is a separate frontend on a Python API, so the application can later be hosted without being rebuilt. The frontend is built with React, and [architecture/application.md](architecture/application.md) says how. Being able to see and edit the story matters more than matching any earlier screen.

## What waits

Locations can be entities in the Story Bible. Routes, travel, and a scrubber for moving through a place stay in the separate Story Space & Timeline project until a later decision brings them in.

Plot is planned directly, as events and arcs. An agent may look harder at a character or a place when a step needs that. That deeper look is not the mechanism that decides the plot.

Ways to explore alternate plots, or to interview a character about the world, wait until the arc workflow exists. An agent's changes land as they succeed. The writer is never asked to approve a batch before it is saved; instead the writer sees what each turn changed and can put any of it back. That is the review this product aims at, and the agents doc records it.
