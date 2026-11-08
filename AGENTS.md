# AGENTS.md

Guidance for AI coding agents working in this repository. This file is a first draft. Several decisions are still open, and it will change as they close.

## What this project is

A workspace for writing long-form fiction. The writer describes the story they want, agents turn that description into a Story Bible (entities, properties, assertions, events, arcs) and later into prose, and the writer inspects, edits, and steers the result. The Story Bible is the shared object. Agents write to it through tools; the writer edits it directly; both go through the same commit, and every change can be seen and reverted.

Measuring whether a prompt, model, or workflow change actually helped is part of the product, not a follow-up.

Nothing is implemented yet. The design lives in `docs/`.

## What the project is for

The project's owner is building it to learn about and experiment with agentic workflows and evaluating agentic systems. Spend design effort accordingly:

- **Design carefully:** agent workflows, tools, prompt assembly, model-call logging, and evaluations (fixtures, checks, the judge, run comparison).
- **Keep simple:** the UI, the data store, auth, deployment, and other supporting infrastructure. They must be correct and meet what the docs require, but prefer the plainest approach that does, and do not add machinery the current slice does not need.

When a supporting piece starts to need a lot of design, say so and propose the simpler version before building it.

## You, the docs, and the code

The project owner decides what to build. `docs/` is the written record of those decisions: the vision, the architecture, what is settled, and what is still open. The code implements the docs.

- **The owner's request wins.** A request that differs from the docs is not a conflict to resolve or a reason to push back. It means the docs are about to change. Point out what else in the docs the change touches, so the owner decides with the full picture, then plan the update.
- **Plan against the docs.** Before planning, read `docs/README.md`, then the docs that own the area you are touching. `docs/architecture.md` maps each part of the system to its doc. Design against what they say, not against assumptions or what the code happens to do.
- **Docs change first.** When a plan changes the vision, the architecture, a settled decision, or a documented rule, its first step is updating the docs, and the owner agrees to that before the code changes.
- **The docs win over everything except the owner.** If the code and a doc disagree, the code is presumed wrong. If the docs seem wrong to you, raise it. Do not change a doc to match code you wrote, or to make a task easier, without the owner agreeing.
- `docs/build-sequence.md` sets the order of work. Build the current step, not a later one.
- `docs/open-questions.md` lists settled and open decisions. Do not reopen a settled item unless the owner asks. When a task needs an open question answered, ask the owner rather than deciding it silently.

## Work in small, visible steps

This is a large project. Progress should come in small steps the owner can see, not in long stretches of invisible work.

- When planning or designing a change, help break it into steps that each leave something visible and working: a test that passes, a command whose output shows the new behavior, or a screen that does something new. Aim for steps that fit in about a day.
- Prefer the smallest step that moves the current slice forward. Defer anything the step does not need, and note it in the plan or in `docs/open-questions.md` instead of building it.
- Small does not mean sloppy. Each step is done properly: it follows the docs, it is tested, and it does not leave hacks, stubs that pretend to work, or shortcuts that a later step has to undo. If doing it right is bigger than one step, say so and split the work. Do not shrink it by cutting corners.
- Keep the number of decisions per step small. When a step needs a decision, present the few options that matter, recommend one, and leave the rest for later.
- When a request is large, propose the split before starting.

## Tech stack

Use these. Changing one is an architecture change: update the docs first.

- **Python 3.14**, managed with **Poetry**.
- **FastAPI** for the API, served by Uvicorn. Server-sent events use FastAPI's `EventSourceResponse`.
- **LangGraph** for agent orchestration, with agents built through LangChain's `create_agent` and one shared builder (see `docs/architecture.md`).
- **Pydantic** for record, tool, and request schemas.
- **OpenRouter** for model access, using the user's own API key.
- **SQLAlchemy 2.1** (async) for the stores, with **Alembic** for migrations. **SQLite** locally through `aiosqlite`, **Postgres** when hosted through `psycopg`. LangGraph's SQLite and Postgres checkpointers hold conversation threads.
- **pytest** for tests, **Ruff** for linting and formatting, **mypy** for type checking.
- **Railway** as the eventual hosted target. The local app comes first.
- The UI is a **separate frontend** that talks only to the Python API.

Not yet decided: the frontend framework (question 21 in `docs/open-questions.md`, closed before slice 2 builds a view) and the LangChain integration used to reach OpenRouter (decided in slice 3). Update this section when they are.

## Commands

```bash
poetry install              # create .venv and install dependencies
poetry run pytest           # tests
poetry run ruff check .     # lint
poetry run ruff format .    # format
poetry run mypy             # type check
```
