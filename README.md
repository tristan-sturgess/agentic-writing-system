# Agentic Writing System

A workspace for writing long-form fiction. A writer describes the story they want. Agents turn that description into a Story Bible — the people and other entities, what is true about them, how they relate, the events, and the arcs that shape those events — and later into prose. The writer inspects the bible, edits it by hand, and steers the next pass with another prompt.

The Story Bible is the shared record. Agent writes and hand edits go through the same commit, so every change can be seen and put back. Comparing a prompt, model, or workflow change against the previous run, including cost and time, is part of the product.

The design lives in [`docs/`](docs/README.md).

## Current state

Slice 1 is built: the Story Bible records and rules, a SQLite story store, commits, the story API, and import.

Slice 2 is partway through, and the screens are read-only. The app lists stories and, for one story, shows its records, a timeline of events with the entities and arcs on it, one entity's properties over story time, and a graph of every record and the references between them. Selecting a record opens a detail panel.

On-screen editing, the arc-planning agent, evaluations, and prose are still ahead. [`docs/build-sequence.md`](docs/build-sequence.md) is the order of work.

## Requirements

- Python 3.14, with [Poetry](https://python-poetry.org/)
- Node.js 22.12 or later, for the frontend

## Run

```bash
poetry install
npm --prefix frontend install
npm --prefix frontend run build

poetry run python -m agentic_writing_system serve
```

Open <http://127.0.0.1:8000>. The API docs are at <http://127.0.0.1:8000/api/docs>.

The service stores its data in `data/`, or in the directory named by `WRITING_DATA_DIR`. It starts without a frontend build; `/` then says how to build one.

With the service running, import a sample story:

```bash
poetry run python scripts/story_api.py import samples/sample_story.json
```

For frontend work with live reload, leave the service running and start the dev server. It serves the UI at <http://localhost:5173> and forwards `/api` to the service on port 8000 (or to `WRITING_API_URL`):

```bash
npm --prefix frontend run dev
```

## Checks

```bash
poetry run pytest
poetry run ruff check .
poetry run ruff format --check
poetry run mypy
npm --prefix frontend run check
```
