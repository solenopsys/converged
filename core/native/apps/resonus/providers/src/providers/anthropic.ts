/**
 * Anthropic Messages API.
 *
 * Ported from `src/llm/claude.zig`. The wire dialect differs from OpenAI's in
 * three ways worth naming, because they are what the hooks below exist to
 * absorb: the system prompt is a top-level field rather than a message, tool
 * calls and their results travel as content blocks instead of a parallel array,
 * and streamed tool arguments are correlated by the block `index`.
 */

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: `${secret:...}`,
// `${env:...}` and `${model}` are the core's substitution syntax, resolved in Zig
// before the request goes out. They are deliberately not template literals: a
// secret must never be interpolated by JavaScript.

import { defineProvider } from "../schema.ts";
import { hooks } from "./anthropic.hooks.ts";

export default defineProvider({
	name: "anthropic",

	transport: {
		kind: "https",
		stateful: false,
		url: "${env:RT_ANTHROPIC_BASE_URL:https://api.anthropic.com/v1}/messages",
		headers: {
			"content-type": "application/json",
			"x-api-key": "${secret:anthropic}",
			"anthropic-version": "2023-06-01",
		},
	},

	decode: {
		framing: { prefix: "data:" },
		eventType: "type",
		events: {
			message_start: {
				emit: "usage",
				inputTokens: "message.usage.input_tokens",
			},

			// Carries both halves of the turn's ending, in one event.
			message_delta: [
				{ emit: "finish", finishReason: "delta.stop_reason" },
				{ emit: "usage", outputTokens: "usage.output_tokens" },
			],

			content_block_start: {
				when: "content_block.type",
				cases: {
					tool_use: {
						emit: "tool_call.begin",
						callKey: "index",
						id: "content_block.id",
						name: "content_block.name",
					},
				},
				default: { emit: "ignore" },
			},

			content_block_delta: {
				when: "delta.type",
				cases: {
					text_delta: { emit: "text.delta", text: "delta.text" },
					input_json_delta: {
						emit: "tool_call.delta",
						callKey: "index",
						argumentsText: "delta.partial_json",
					},
				},
				default: { emit: "ignore" },
			},

			error: { emit: "fatal", message: "error.message" },
		},
		unknown: { emit: "ignore" },
	},

	hooks,
});
