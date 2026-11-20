# AGENTS.md

Guidance for AI coding agents working in this repository. This file is a first draft. Several decisions are still open, and it will change as they close.

## What this project is

A workspace for writing long-form fiction. The writer describes the story they want, agents turn that description into a Story Bible (entities, properties, assertions, events, arcs) and later into prose, and the writer inspects, edits, and steers the result. The Story Bible is the shared object. Agents write to it through tools; the writer edits it directly; both go through the same commit, and every change can be seen and reverted.

Measuring whether a prompt, model, or workflow change actually helped is part of the product, not a follow-up.

Slice 1 of `docs/build-sequence.md` is built: the Story Bible records and rules, the story store on SQLite, the commit, the story endpoints, and import. Slice 2 has the records view, a route per built view, the read-only detail panel, the edge on a time point that names an Event, Event times from the service, the timeline, including the Entities and Arcs on it, the entities view, and the graph. Nothing can be edited on screen yet, and there is no agent. The design lives in `docs/`.

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
- **Playwright** for Python, with Chromium, as a development-only tool in a Poetry dev group. It drives the screenshot command for the graph, so a layout can be judged and compared from images. It is not part of the app and does not test screens: a screenshot goes with the report of a check in the browser.
- The UI is a **separate frontend** that talks only to the Python API. It lives in `frontend/`: **React** and **TypeScript**, built by **Vite**, with **Mantine** for components, managed with **npm** on Node 22.12 or later. **Vitest** for its tests, **ESLint** for linting. Its API types are generated from the service's OpenAPI document. `docs/architecture/application.md` says how it is built and served. `docs/ui.md` says which screens exist and the questions each view must answer, and each view has its own doc under `docs/ui/`. Before changing `frontend/`, read `.cursor/rules/frontend-mantine.mdc` and use the Mantine MCP server in `.cursor/mcp.json`. Forms, comboboxes, and custom components have skills under `frontend/.agents/skills/`.

Not yet decided: the LangChain integration used to reach OpenRouter (decided in slice 3). Update this section when it is.

## Testing

Test enough to show the step works as intended. At this stage that is not exhaustive coverage. Prefer a few tests that would catch a real break over many that restate the code.

- A step is done when `pytest`, `ruff check`, `ruff format --check`, and `mypy` all pass.
- A step that touches `frontend/` is done when `npm --prefix frontend run check` also passes: the generated API types are current, and the lint, the tests, the type check, and the build pass. Frontend tests cover logic that does not render, such as laying spans out in story time. A screen is not tested by rendering it in a test; it is checked by using it in a browser against a service on a scratch data directory, and the report says what was done and what was seen.
- A Story Bible rule gets a test for the case it refuses, and that test asserts what the refusal carries (the field or record, the legal ids, the referring records), because an agent corrects itself from that payload.
- Store tests use a real SQLite file in a temporary directory, with the schema from the real migration. Do not mock the store or the engine.
- Endpoint tests call the app in-process and test the mapping from outcome to response. They do not test the rules a second time.
- Once a step touches the API, also use it the way a client would. Start the service on a scratch data directory and a spare port, never on the real `data/`, send requests with `scripts/story_api.py` or `curl`, and try a few inputs the tests do not name. Report what you sent and what came back.
- A bug found that way becomes a failing test before it is fixed.
- If a response is correct by the docs but hard to act on, tell the owner. Do not change the contract to suit the caller; the docs change first.

## Commands

```bash
poetry install              # create .venv and install dependencies
poetry run pytest           # tests
poetry run ruff check .     # lint
poetry run ruff format .    # format
poetry run mypy             # type check
poetry run python -m agentic_writing_system serve    # the API on http://127.0.0.1:8000, docs at /api/docs
poetry run python scripts/story_api.py --help        # command-line client for the story endpoints
poetry run playwright install chromium               # once, the browser the screenshot command drives
poetry run python scripts/graph_screenshot.py --help # a PNG of a story's graph from a running service (slice 2, step 8)

npm --prefix frontend install        # install the frontend's dependencies (Node 22.12 or later)
npm --prefix frontend run build      # build the frontend into frontend/dist, which `serve` then serves at /
npm --prefix frontend run dev        # the frontend with live reload on http://localhost:5173, forwarding /api to the service
npm --prefix frontend run check      # API types current, lint, tests, type check, and build
npm --prefix frontend run api-types  # regenerate frontend/src/api/schema.d.ts after an endpoint or a schema changes
```

`serve` runs without a frontend build; the API works and `/` says how to build. The dev server forwards `/api` to `http://127.0.0.1:8000`, or to the address in `WRITING_API_URL` when the service is on another port.

The service keeps its data in `data/`, or in the directory named by `WRITING_DATA_DIR`. `samples/sample_story.json` is a small story to import: `poetry run python scripts/story_api.py import samples/sample_story.json`.
