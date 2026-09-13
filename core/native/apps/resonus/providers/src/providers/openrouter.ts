/**
 * OpenRouter Chat Completions.
 *
 * OpenRouter speaks the OpenAI Chat Completions dialect, so the decode half is
 * `openai.ts` verbatim: every SSE frame is the same `choices[].delta` shape, so
 * the table uses `always` instead of `events`, and tool calls are correlated by
 * their own `index`. What differs is not the wire grammar but the request body
 * and the endpoint, and both live in `openrouter.hooks.ts` and the transport
 * below — no core change is needed to add this provider.
 *
 * The `: OPENROUTER PROCESSING` keep-alive comments OpenRouter interleaves are
 * plain SSE comment lines; the `data:` framing prefix skips them before the
 * parser ever sees them.
 */

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: `${secret:...}`,
// `${env:...}` and `${model}` are the core's substitution syntax, resolved in Zig
// before the request goes out. They are deliberately not template literals: a
// secret must never be interpolated by JavaScript.

import { defineProvider } from "../schema.ts";
import { hooks } from "./openrouter.hooks.ts";

export default defineProvider({
	name: "openrouter",

	transport: {
		kind: "https",
		stateful: false,
		url: "${env:RT_OPENROUTER_BASE_URL:https://openrouter.ai/api/v1}/chat/completions",
		headers: {
			"content-type": "application/json",
			authorization: "Bearer ${secret:openrouter}",
		},
	},

	decode: {
		framing: { prefix: "data:", done: "[DONE]" },
		always: [
			{ emit: "text.delta", text: "choices.0.delta.content" },
			{
				each: "choices.0.delta.tool_calls",
				rule: {
					emit: "tool_call.delta",
					callKey: "index",
					id: "id",
					name: "function.name",
					argumentsText: "function.arguments",
				},
			},
			{ emit: "finish", finishReason: "choices.0.finish_reason" },
			{
				emit: "usage",
				inputTokens: "usage.prompt_tokens",
				outputTokens: "usage.completion_tokens",
			},
		],
	},

	hooks,
});
