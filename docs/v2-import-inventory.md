# Version 2 import inventory

Reviewed against the local clone at `E:\dev\writing-agent-v2`, commit `f158920` (2026-08-27), repository https://github.com/tristan-sturgess/creative-writing-assistant.

Nothing from the clone was copied except the documentation in [v2/](v2/SOURCE.md). This list is the recommendation for what to bring later. "Adapt" means reimplement the idea against the version 3 model. "Port" would mean move code with small changes. Almost nothing is a clean port, because the Story Bible schema and the storage model both change.

## Adapt into the early slices

| Idea | Where it lives in v2 | Use it for |
| --- | --- | --- |
| Tool validation that rejects unknown ids and returns the legal ones | `app/tools/validation.py`, `app/tools/story_bible.py`, `app/tools/scene.py` (`_resolve_scene_character_ids`) | Every version 3 write tool. The tests that pass hallucinated ids are worth imitating (`tests/test_tool_validation.py`, `tests/test_story_bible_tools.py`). |
| Transaction around mutate + save, with rollback | `app/world/store.py` (`world_transaction`), `app/persistence/world.py` | The story write API. Recreate the guarantee. Do not recreate the process-global lock as the design. |
| Draft copy, then commit if the live revision is unchanged | `app/world/draft.py` (`PlotDraft`) | Multi-step arc edits that should land together. Drop the intimacy bookkeeping inside the draft. |
| Readable, frozen slug ids | `app/world/models.py` | Entity and event ids. Renames must not break references. |
| LLM call log: model, prompt, response, timing | `app/persistence/llm_call_logs.py`, `app/models/debug_logging.py`, [v2/architecture_llm_debug_logging.md](v2/architecture_llm_debug_logging.md) | Eval runs and cost comparison. Attribute calls to a story and a workflow step. |
| Per-step model configuration | `app/models/`, [v2/model_configuration.md](v2/model_configuration.md), [v2/model_selection_analysis.md](v2/model_selection_analysis.md) | When the arc agent has more than one model call. OpenRouter via `langchain-openai` is the existing access path. |
| Prompt assembly that adds bible context on demand | `app/graphs/context.py`, [v2/architecture_prompt_assembly.md](v2/architecture_prompt_assembly.md) | The arc agent's read tools. The version 2 `STORY_BIBLE_PRIMER` describes the old model and should be rewritten, not reused. |
| Job claims as a UI/workflow courtesy lock | `app/graphs/jobs.py`, [v2/architecture_async_jobs.md](v2/architecture_async_jobs.md) | Keep a running agent from looking idle. Consistency still comes from transactions. |
| Timeline graph as a way to see events | Timeline page described in [v2/story_bible_model.md](v2/story_bible_model.md) | Slice 2 visualizations. Mermaid was the version 2 rendering. The version 3 view needs arcs as well as events. |
| ZIP import/export of a story | `app/persistence/world_zip.py`, [v2/zip_import_export.md](v2/zip_import_export.md) | Later, once the schema settles. Useful for fixtures and for moving a story off a machine. Secrets stayed out of the export. Keep that. |

## Leave until the prose slice

| Idea | Where it lives in v2 | Why it waits |
| --- | --- | --- |
| Scene-writing workflow: outline, bounded review/revise, context dossier, draft | `app/graphs/scene_workflow.py`, [v2/architecture_agent_workflows.md](v2/architecture_agent_workflows.md) | Slice 5. The enforced-graph pattern is the part to reuse. The stance and intimacy prompts are not. |
| Continuity from neighboring scenes | `app/world/scene_context.py` | Depends on narrative units and prose existing. |
| Markdown scene editor and canvas streaming | `app/ui/components/markdown_editor.py`, `app/ui/components/canvas_stream_parser.py` | Prose UI. The canvas path also had rollback edge cases (`known_issues.md` item 4). |
| Readable HTML export of a story | `app/persistence/story_export.py` | After there is prose to read. |
| Scene generation queue and prerequisite ordering | `app/world/scene_order.py`, [v2/architecture_async_jobs.md](v2/architecture_async_jobs.md) | Only matters once many scenes generate together. |

## Do not bring over as the version 3 core

| Idea | Why |
| --- | --- |
| Evidence-based intimacy interpretation and derived ranks | `app/world/evidence.py`, `app/world/replay.py`, `app/graphs/intimacy_workflow.py`, `app/graphs/intimacy_interpretation.py`, [v2/intimacy-state-change-workflow.md](v2/intimacy-state-change-workflow.md). This is the expensive simulation chain version 3 is moving away from. Beliefs can return later as ordinary Properties or Assertions with temporal bounds. |
| World-state effect types and signal effect records | Tied to replay. Draft 2 uses new statements plus validity instead. |
| NiceGUI application | `app/ui/`. The layout ideas are noted in [architecture-direction.md](architecture-direction.md). The framework is not the starting point. The NiceGUI skill under the clone's `.cursor/skills/` was not copied. |
| Single in-memory `World` singleton and one `world.json` | Conflicts with multiple stories and with Railway. |
| In-memory `JobManager` as the durability story | Jobs vanished on restart. Fine as a local status board. Not the hosted orchestration design. |
| Chat history stored beside the world in `data/chat_history.json` | Version 2 never put it in the portable world (`known_issues.md` item 2). Decide with the chat slice whether a conversation belongs to the story. |
| Version 2 schema migrations | The version 3 schema is new. There is no `world.json` compatibility requirement. |

## Prompts

Writer and planner prompts live inside the graph modules (`app/graphs/plot_agent.py`, `app/graphs/scene_workflow.py`, `app/graphs/chat_agent.py`, `app/graphs/context.py`). They are worth reading when the arc-agent prompt is drafted. They should not be copied in. They instruct the model to maintain signals, intimacies, and scene blueprints that version 3 is not using.

## Tests worth rereading

The clone's tests are documentation of the invariants version 2 actually enforced. The ones that transfer as *ideas* are the tool-validation tests, the world-save rollback tests (`tests/test_world_save_retry.py`), and the plot-draft commit tests (`tests/test_plot_draft.py`). Scene, intimacy, and NiceGUI user-fixture tests document behavior we are not porting.

## Docs worth rereading while building

Already copied into [v2/](v2/SOURCE.md). The ones that still pay off during early slices:

- [v2/architecture.md](v2/architecture.md) for the concurrency narrative.
- [v2/known_issues.md](v2/known_issues.md) so the same edge cases are chosen deliberately.
- [v2/story_bible_model.md](v2/story_bible_model.md) when deciding which event-relation ideas survive.
- [v2/architecture_agent_workflows.md](v2/architecture_agent_workflows.md) when designing the arc agent and, later, the prose workflow.

[v2/implementation_plan.md](v2/implementation_plan.md) records that version 2's own phased plan was complete. It is history, not a backlog for this repo. [v2/future_work.md](v2/future_work.md) has a few items that still match version 3: relationship tracking (now Assertions), arc membership (now first-class), user review before a plot commit, and multiple conversations. The rest is version 2 UI polish.
