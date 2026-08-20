/**
 * OpenAI Chat Completions.
 *
 * Ported from `src/llm/openai.zig`. Unlike the other two, its stream frames have
 * no discriminator field: every SSE frame is the same `choices[].delta` shape,
 * so the table uses `always` instead of `events`. Tool calls arrive as an array
 * inside the delta and are correlated by their own `index`.
 */

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: `${secret:...}`,
// `${env:...}` and `${model}` are the core's substitution syntax, resolved in Zig
// before the request goes out. They are deliberately not template literals: a
// secret must never be interpolated by JavaScript.

import { defineProvider } from "../schema.ts";
import { hooks } from "./openai.hooks.ts";

export default defineProvider({
	name: "openai",

	transport: {
		kind: "https",
		stateful: false,
		url: "${env:RT_OPENAI_BASE_URL:https://api.openai.com/v1}/chat/completions",
		headers: {
			"content-type": "application/json",
			authorization: "Bearer ${secret:openai}",
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
