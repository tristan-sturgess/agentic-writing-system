# Model configuration

This is how the user chooses models, and how a system-prompt prefix rides along with every call that uses that choice. Prompt composition, and which other context belongs in which layer, is in the prompt-assembly doc. The call record is in the logging doc. This doc owns the configs, the selection, and the rule that every model call is an agent whose middleware puts the prefix on the request before that record is written.

## A config is application data

A model config belongs to a user. Each user has their own configs, in the local build and on the hosted deployment. The configs are not part of a story and are not in a story export. Copying or deleting a story leaves that user's configs alone.

The user provides their own OpenRouter API key in the UI. The key belongs to that user, with their configs. It is not a field on a config. The config document, its export, and a story export contain no key. How the key is stored is open in [open-questions.md](open-questions.md). The persistence doc chooses a store that keeps it out of exports and logs. The screen that collects it waits with the rest of the UI. Editing configs works with no key. A model call without a key fails with a clear error and does not send the request.

A config has:

| Field | Required | Role |
| --- | --- | --- |
| `id` | yes | Stable id. Node selections store this, not the model name. |
| `name` | yes | Label shown to the user. |
| `model` | yes | OpenRouter model id, such as `anthropic/claude-sonnet-5`. |
| `temperature` | no | Sampling temperature. Omitted means the provider default. |
| `reasoning_effort` | no | One of `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. Omitted means no reasoning parameter is sent. |
| `max_tokens` | no | Cap on output tokens. Omitted means no cap. When set, it is at least 1. |
| `system_prompt_prefix` | no | Standing text for every call that uses this config. Empty means no prefix. |

`reasoning_effort` is sent as OpenRouter's unified `reasoning.effort`. On Anthropic models through Claude 4.5, OpenRouter turns that into a thinking-token budget derived from `max_tokens`. On Claude 4.6 and later it maps to Anthropic's effort setting, where `xhigh` and `max` mean something; older models fall back to `high`. A `max_tokens` cap that is tight relative to the effort level leaves no room for the reply, because the thinking budget comes out of that cap.

## Roles

Four role configs are always present. A role names why a model was chosen. It does not name a size. The user can edit a role in place, including its model, sampling, and prefix. The user can add further configs. Deleting a role resets it to the seed below. Deleting any other config removes it.

Version 2 started with a size ladder, `small` / `standard` / `large`. Review nodes landed on the small config because their output was short, then ran at high reasoning effort. The hidden reasoning cost as much and took as long as the draft, and the judgment was worse. Roles replace that ladder. Swapping one role's model retunes every node that uses the role.

The seeds are the models version 2 settled on in July 2026. They give the store a starting value. They are not a requirement that version 3 keep these ids. If an id leaves the catalog, the role remains and the user sets another id.

| Id | What the work is | Seed model | Seed effort |
| --- | --- | --- | --- |
| `orchestration` | Tool-calling agent work. Instruction following and reliable tool use matter more than prose. Chat is input-heavy, so input price matters more than output price. | `anthropic/claude-sonnet-5` | `medium` |
| `writing` | Long prose. Quality per dollar and output speed matter. Planning has already happened upstream, so low effort is enough. This role does not have to be a strong tool caller. | `openai/gpt-5.6-luna` | `low` |
| `judgment` | Critique and targeted revision. The output is short, so a strong model stays cheap. Revision quotes existing text exactly and writes a short replacement, which is the same shape of work. | `anthropic/claude-sonnet-5` | `medium` |
| `structure` | Schema-filling and summarization. Fast, cheap, reliable structured output. | `google/gemini-3.5-flash-lite` | `low` |

A node that calls a model is classified into one of these roles before it gets a selector. A step that gathers context with tools uses `orchestration`, including when a later step writes prose. The writing role can then point at a prose specialist. Version 2's price tables, Elo scores, and candidate lists were a point-in-time survey. They are not part of this doc.

`orchestration` is also the fallback config in [Resolution](#resolution). It is always present, so resolution always returns a config.

## Node registry

Nodes select a config through a registry. The UI does not hard-code model ids, and it only offers a selector for a node that is registered.

| Field | Role |
| --- | --- |
| `node_id` | Stable id stored in the selections map. |
| `label` | Name shown to the user. |
| `default_config_id` | Role used when the user has no selection for this node. |

The registry starts with the arc-planning conversation:

| `node_id` | Label | Default |
| --- | --- | --- |
| `chat` | Arc-planning chat | `orchestration` |

Add a registry entry, with a role as its default, before the UI exposes a selector for that node. Version 2's scene-writing nodes and intimacy nodes are not in this registry. When the prose slice adds model calls, those nodes are classified then. An imported version 2 config file keeps the four roles and a `chat` selection. Selections for nodes this registry does not have are dropped.

## Resolution

For a node, resolution returns:

1. The user's saved selection for that node, when that config still exists.
2. The registry default for that node, when that config still exists.
3. The `orchestration` config.

An unknown node id has no registry default, so it resolves to `orchestration`. The UI does not offer a selector for an unknown node. Saving a selection rejects an unknown node and rejects a config id that does not exist.

The caller resolves once for the node it is building, then builds an agent from the resolved binding. The binding carries the prefix. The node's own base prompt is supplied separately.

A cached agent includes the prefix, the model id, the sampling options, and the node's base prompt in its cache key. Saving an edit then takes effect on the next build. Version 2 rebuilt the chat agent when the prefix changed, for this reason.

## The prefixed agent

Resolution returns a binding: a chat model with the config's model id, temperature, max tokens, and reasoning effort set, plus the prefix string. Code outside the factory does not build a chat model from a config, and the binding does not hand out its model. The binding builds agents.

Every model call is an agent from `create_agent`. The chat loop is one. A one-shot call is a tool-less agent, with `response_format` set when the output is structured, placed in the workflow graph as a node. LangChain's middleware runs inside the compiled graph that `create_agent` returns, so a one-shot agent nested in a larger `StateGraph` keeps its middleware. The workflow node invokes that agent with its own input, the user message for the step, and reads the result or `structured_response` from the return value. The agent's message list is its own; it is not the workflow's state. There is no second call path for one-shot calls, so there is no second place the prefix could be missed. A caller cannot use the config's model and skip the prefix.

The agent builder takes the node's base prompt and tools, and passes a fixed middleware list to `create_agent`. The prefix middleware is first. On each model call, LangChain builds a `ModelRequest` whose `system_message` field holds the base prompt as a `SystemMessage`, separate from the conversation in `messages`. The prefix middleware is a `wrap_model_call` hook:

- An empty prefix passes the request through.
- Otherwise it calls the inner handler with `request.override(system_message=...)`, where the new system message is a text block holding the prefix followed by the existing content blocks. Blocks, not string concatenation, so a base prompt that carries cache-control metadata keeps it.

That is the whole merge. There is no idempotency check:

- `override` returns a new request and leaves the original alone. A retry middleware listed after the prefix middleware calls the inner handler again with the already-prefixed request. A retry that wraps the agent runs the prefix middleware again on the original request. Neither path prepends twice.
- `system_message` always exists on the request, so there is no "insert one if missing" case.
- Streaming and non-streaming calls build the same `ModelRequest`. A fallback from one to the other happens below the middleware and does not re-run it.

The node's base system prompt is a different string. The prompt builder owns that string and does not read the prefix. The middleware applies the prefix.

The prefix is part of the model request only. It is not written into the conversation's stored message list, and `stream_mode="messages"` never emits it. Version 2 wrote a system prompt into message state, and the chat transcript showed it. The prompt-assembly doc owns the rest of that rule: static prompt text stays on the model request, and a stream consumer filters by message type.

The logging middleware is last in the list, so it is innermost. The request it sees already carries the prefix and the base prompt, and it wraps only the provider call. Logging the conversation's stored messages would miss both. The logging doc owns the record.

## Store

Each user has one JSON document of the shape below. The local single-user build stores it as `model_configs.json` in the data directory. The persistence doc names that directory and how a hosted user's document is addressed. Writes replace the file atomically: write a temporary file, then replace the target. Readers and writers go through the store. UI code does not open the file itself.

```json
{
  "configs": [
    {
      "id": "orchestration",
      "name": "Orchestration",
      "model": "anthropic/claude-sonnet-5",
      "temperature": null,
      "reasoning_effort": "medium",
      "max_tokens": null,
      "system_prompt_prefix": ""
    }
  ],
  "selections": {
    "chat": "orchestration"
  }
}
```

Load and save always put the four roles back if they are missing. A role that is present keeps the user's edits. Custom configs follow, ordered by name. Default selections fill any node the file omits; a selection in the file wins.

The store supports list, get, save, delete, select, resolve, export, and import.

- Save creates or updates one config by id. Saving a role id edits that role.
- Delete on a role id restores the seed. Delete on any other id removes it and drops selections that pointed at it. Those nodes then resolve through the registry default.
- Select stores a node id to a config id, after the checks in [Resolution](#resolution).

Export and import move this document between installations. They do not touch a story.

- The file is the JSON document above. There is no ZIP wrapper.
- Export writes the stored document after the four roles have been filled in.
- Import replaces the current document. Missing roles are filled from the seeds. Roles present in the file keep the imported values. The parse validates the JSON and fails with a clear error on bad encoding, invalid JSON, a non-object payload, or a schema violation.
- After import, a selection whose node is not registered, or whose config does not exist, is dropped.

## Choosing a model

The user edits a config in the UI: model, temperature, reasoning effort, max tokens, and prefix. The user assigns a config to each registered node.

The model list comes from the live catalog:

```text
GET https://openrouter.ai/api/v1/models
```

The parser needs each model's `id` and display `name`. The process may cache the list. The user can refresh it. If the fetch fails, editing continues and the model field accepts a typed id, so a saved config can be kept or changed without the catalog.

## What later docs own

The prompt-assembly doc owns how the base prompt, Story Bible context, and conversation messages are built, and the stream filter that keeps system text out of the transcript. This doc's promise to that one: the prefix is already on the model request, and it is not part of the stored conversation.

The logging doc owns the logging middleware and the record. This doc's promise to that one: every model call goes through an agent whose middleware list has the prefix middleware before the logging middleware, so the request the logger sees is the request the provider gets.

The persistence doc owns the local data directory, how a user's config document is addressed, and how that user's API key is stored. Prose nodes are added to the registry when that slice exists.
