# Prompt assembly

This is how the text of one model call is constructed, and which context belongs in which layer. The model-configuration doc owns the config, the selection, and the middleware that applies the prefix. The logging doc owns the call record. This doc owns the layers. The recorded prompt is the model request after that middleware, including the system message and the prefix. It is not the conversation's stored message list.

## The request and the conversation

A system prompt that is static for the run is part of the model request. It is not inserted into the conversation's message channel.

Version 2 put the system prompt into the message channel. The stream then emitted it, and the chat transcript showed the system prompt at the front of the assistant's reply, because the consumer rendered every chunk's text. The stored conversation was also carrying a system message that was not part of the dialogue.

There are three places a piece of context can live, and its lifetime picks the place:

- Static for the run: the model request's system message. `create_agent`'s `system_prompt` and the prefix middleware put it there.
- This call only: the model request's `messages`. A `wrap_model_call` middleware returns `request.override(messages=[...])` with the extra content appended. The state is untouched, and later calls and later turns do not see it.
- This turn and the turns after it: the message channel. The app puts it on the user message when it builds that turn. No middleware rewrites state to do this. Version 2 proposed a `before_model` hook that cleared the channel with `RemoveMessage` and wrote a rebuilt list; that is the short-term-memory trimming idiom, and it is not needed to annotate a turn.

Anything written to the message channel can appear in `stream_mode="messages"`. Content on the model request, system message or messages override, does not. [The stream](#the-stream) still filters by message type, because tool results and anything on the user message are on the channel and are not the assistant's reply.

## Layers

One call is built from four layers, outermost first.

| Layer | Where it lives | Who sets it |
| --- | --- | --- |
| Model-config prefix | The model request's system message, in front of the base prompt | The prefix middleware in [model-configuration.md](model-configuration.md) |
| Node or workflow base prompt | The rest of that system message | The node's prompt builder, passed to `create_agent` as the system prompt |
| Retrieved Story Bible context | Tool messages on this turn, or a labeled bundle attached to this turn when a research step exists | Read tools now. An optional later research step, DEF-56 |
| Conversation | The user, assistant, and tool messages for this run | The conversation store and the agent loop |

The prefix and the base prompt are content blocks on `ModelRequest.system_message`, not one concatenated string. The prefix middleware prepends its block and leaves the base blocks as they are, including any cache-control metadata on them. The prompt builder does not read the prefix text.

Every model call is an agent from `create_agent`, including a one-shot call. A one-shot node has no standing chat history. Its input is the user message for that step, its base prompt is the system prompt, and the same prefix middleware runs. `response_format` is set when the output is structured. The model-configuration doc is the authority for that shape.

A cached agent includes the base prompt in its cache key, along with the prefix, model id, and sampling options already named in the model-configuration doc.

## Story Bible context

The arc agent reads the Story Bible through tools. A tool returns stored records, or the in-force view when the question is what holds at a time. The result is a tool message on that turn. It is not copied into the system prompt, and the tool does not paraphrase a record into a new claim.

A summarizing research step can sit in front of a planner later (Linear DEF-56). Until it exists, the agent uses the read tools and skips the summary. When it exists, anything it writes is synthesized context. The bundle has to say so, in a way the model can tell from a stored Property, Assertion, or other Story Bible statement. A stored statement is quoted from the bible. A summary, a selection note, or a statement that something was missing is marked as produced for this request. The bundle is attached to the turn it was built for. It does not become a standing system prompt that later turns inherit.

How that step searches, what it compresses, and which model runs it stay open in [open-questions.md](open-questions.md). Routes, whereabouts, and the other Story Space queries stay in that project. Until they are brought in, a location is an Entity and is read like any other record.

## What the user has open

A note about the page or record the user currently has open goes with the current user message. It is not part of the system prompt, and the prefix middleware does not touch it.

The note is there so the model can see what the user is looking at. The assistant's visible reply is still only assistant text. For the arc agent, the note is a content block on the user message as the app submits it, and the thread stores it, so a later turn can see what the user meant by "change this." The agents doc is the authority for that placement. A `wrap_model_call` override that hides the note from later turns is not used.

## The stream

A consumer of the model stream renders assistant message chunks as the assistant's reply. It does not render every chunk's text. Tool messages, turn notes, and any other non-assistant chunk stay out of that reply.

That filter is part of keeping a system prompt out of the transcript. The other part is the layer rule above: the prefix and the base prompt are on the model request, so `stream_mode="messages"` does not emit them. Both stay. Version 2 needed the filter because the system prompt had been written onto the message channel. Keeping the prompt on the request removes that leak. Filtering still matters for everything else the channel carries.

## Where a new piece of context goes

- A standing instruction for every call that uses a model config goes in that config's prefix. The prefix middleware applies it.
- Instructions that define this node's job, and stay fixed for the run, go in the base prompt.
- A fact the agent should look up from the Story Bible goes through a read tool. The result is a tool message.
- A bundle prepared for this request, including a future research summary, is attached to this turn, or is the input of a one-shot node. If the bundle is not itself a stored statement, it is marked as synthesized. If only this call should see it, it goes on the request through the messages override instead of the channel.
- What the user currently has open goes on the current user message, and the thread stores it. The agents doc sets that placement for the arc agent.
- The dialogue itself is the conversation: user, assistant, and tool messages.

The logging middleware is last in the list. The request it records is the one the provider receives: the system message with the prefix and the base prompt, and the messages for this call after any override. Logging the stored conversation alone would miss the system message and anything added on the request.

## What later docs own

The agents doc writes the arc agent's base prompt and its tools. This doc does not. Version 2's chat-agent primer and its scene-workflow prompt sequence described the old Story Bible, and they are not reused here.

The logging doc owns the fields of the call record. This doc's promise to that one is the sentence above: the recorded prompt is the model request, not the stored message list.
