# Creative Writing System

Working documents for version 3 live in this folder. `v2/` and `v3-concept/` are frozen source snapshots. Review the working documents first.

This repository (`agentic-writing-system`) is empty apart from these docs. Nothing has been implemented yet.

## Review these

| Document | What it decides, and what it leaves open |
| --- | --- |
| [vision.md](vision.md) | What the system is for, and how a writing session is supposed to feel. |
| [build-sequence.md](build-sequence.md) | The order to build it: model, then light editing and visualization, then an arc-planning agent, then evals, then prose. |
| [story-bible.md](story-bible.md) | The data model we start from, and how it differs from version 2. |
| [architecture-direction.md](architecture-direction.md) | How the user, the agents, and the Story Bible fit together. |
| [evaluations.md](evaluations.md) | What we measure, and why a prompt change has to be comparable to the last one. |
| [deployment-and-concurrency.md](deployment-and-concurrency.md) | Local first, Railway later, and concurrent Story Bible updates. |
| [v2-import-inventory.md](v2-import-inventory.md) | What from version 2 is worth bringing over, and what to leave behind. |
| [open-questions.md](open-questions.md) | Decisions still waiting on review. |

## Where this briefing differs from the Linear project

The Linear project [Creative Writing System V3](v3-concept/project.md) describes itself as architecture-and-design work only, with implementation as a later project. These working docs follow the 2026-11-02 briefing instead:

1. **This repository is the build.** Design questions stay visible, and implementation starts here once the docs are reviewed.
2. **The build order is fixed enough to start.** Data model, then a little user editing and visualization, then a chat agent that writes story arcs into the model, then evaluations, then prose. Prose stays out of the first slices.
3. **The hosted target is Railway**, with multi-tenancy in the design. The Linear storage issue names Postgres and object storage. It does not name Railway, and it does not name Google Cloud.
4. **NiceGUI is not the starting UI.** Version 2's interface got in the way of the visualizations this version needs. Whether the UI is React is still open.
5. **Story Space & Timeline stays related reference** for now. It is a separate Linear project about physical space and time. It is not part of the first build slice.
6. **Concurrent Story Bible updates are a prerequisite design**, called out from version 2's parallel tool-call failures, ahead of writing agent code.

## Source snapshots

| Folder | Contents |
| --- | --- |
| [v2/](v2/SOURCE.md) | Version 2 docs, README, and `AGENTS.md`, copied from `E:\dev\writing-agent-v2` at commit `f158920` (2026-08-27). |
| [v3-concept/](v3-concept/README.md) | Linear project Creative Writing System V3, its ten issues, and Story Bible Data Model Draft 2. Also the related Story Space & Timeline concept and requirements. Retrieved 2026-11-02. |

Linear and the version 2 repository remain the live sources. These copies can drift.

No application code, prompts, or version 2 modules were copied. The import inventory says what is worth bringing later, after this review.
