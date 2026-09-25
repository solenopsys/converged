/** OpenAI Responses API with a Conversation per bound Resonus session. */

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: descriptor substitutions are resolved by Zig.

import { defineProvider } from "../schema.ts";
import { hooks } from "./openai-responses.hooks.ts";

export default defineProvider({
	name: "openai-responses",

	transport: {
		kind: "https",
		stateful: false,
		url: "${env:RT_OPENAI_BASE_URL:https://api.openai.com/v1}",
		headers: {
			"content-type": "application/json",
			authorization: "Bearer ${secret:openai}",
		},
	},

	session: {
		open: "openSession",
		decode: "decodeSession",
		close: "closeSession",
	},

	decode: {
		framing: { prefix: "data:", done: "[DONE]" },
		eventType: "type",
		events: {
			"response.output_text.delta": { emit: "text.delta", text: "delta" },
			"response.output_item.added": {
				when: "item.type",
				cases: {
					function_call: {
						emit: "tool_call.begin",
						callKey: "item.id",
						id: "item.call_id",
						name: "item.name",
					},
				},
				default: { emit: "ignore" },
			},
			"response.function_call_arguments.delta": {
				emit: "tool_call.delta",
				callKey: "item_id",
				argumentsText: "delta",
			},
			"response.output_item.done": {
				when: "item.type",
				cases: {
					function_call: {
						emit: "tool_call.ready",
						id: "item.call_id",
						name: "item.name",
						args: "item.arguments",
					},
				},
				default: { emit: "ignore" },
			},
			"response.completed": [
				{
					emit: "usage",
					inputTokens: "response.usage.input_tokens",
					outputTokens: "response.usage.output_tokens",
				},
				{ emit: "finish", finishReason: "response.status" },
				{ emit: "turn.end" },
			],
			"response.incomplete": [
				{
					emit: "usage",
					inputTokens: "response.usage.input_tokens",
					outputTokens: "response.usage.output_tokens",
				},
				{ emit: "finish", finishReason: "response.incomplete_details.reason" },
				{ emit: "turn.end" },
			],
			"response.failed": { emit: "fatal", message: "response.error.message" },
			error: { emit: "fatal", message: "error.message" },
		},
		unknown: { emit: "ignore" },
	},

	hooks,
});
