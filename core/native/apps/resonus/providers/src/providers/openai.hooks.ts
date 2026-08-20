/**
 * Warm hooks for `openai` — the business logic, and nothing else.
 *
 * This file is the only part of the provider that is bundled into the QuickJS
 * runtime script. It imports types and shared logic alone, so nothing survives
 * compilation but the functions themselves. The descriptor next to it holds the
 * transport and decode table, which the core reads as data.
 */

import { completion, EMPTY_SCHEMA, parseArgs, str } from "../core.ts";
import type {
	TurnRequest,
	UniformMessage,
	UniformTool,
	WireRequest,
} from "../schema.ts";

function encodeTool(t: UniformTool): unknown {
	return {
		type: "function",
		function: {
			name: t.name ?? "",
			description: t.description ?? "",
			parameters: t.parameters ?? EMPTY_SCHEMA,
		},
	};
}

function encodeMessage(m: UniformMessage): unknown {
	const content = m.content ?? "";

	if (m.role === "tool") {
		return { role: "tool", tool_call_id: m.toolCallId ?? "", content };
	}

	const calls = m.role === "assistant" ? (m.toolCalls ?? []) : [];
	if (calls.length > 0) {
		return {
			role: "assistant",
			content,
			tool_calls: calls.map((call) => ({
				id: call.id ?? "",
				type: "function",
				// Arguments go out as JSON *text*, not as an object.
				function: {
					name: call.name ?? "",
					arguments: JSON.stringify(call.args ?? {}),
				},
			})),
		};
	}

	return { role: m.role, content };
}

export const hooks = {
	encodeTurn(req: TurnRequest, stream: boolean): WireRequest {
		const body: Record<string, unknown> = {
			model: req.model,
			max_completion_tokens: req.maxTokens,
			messages: req.messages.map(encodeMessage),
		};
		if (stream) {
			body.stream = true;
			// Usage is otherwise absent from a streamed response entirely.
			body.stream_options = { include_usage: true };
		}
		if (req.temperature !== undefined) body.temperature = req.temperature;
		if (req.tools.length > 0) {
			body.tools = req.tools.map(encodeTool);
			if (req.requireTool) body.tool_choice = "required";
		}

		return { method: "POST", body: JSON.stringify(body) };
	},

	decodeResponse(raw: unknown) {
		const root = raw as Record<string, unknown>;
		const choices = (Array.isArray(root.choices) ? root.choices : []) as Record<
			string,
			unknown
		>[];
		const first = (choices[0] ?? {}) as Record<string, unknown>;
		const message = (first.message ?? {}) as Record<string, unknown>;
		const rawCalls = (
			Array.isArray(message.tool_calls) ? message.tool_calls : []
		) as Record<string, unknown>[];

		const toolCalls = rawCalls.map((call) => {
			const fn = (call.function ?? {}) as Record<string, unknown>;
			return {
				id: str(call, "id"),
				name: str(fn, "name"),
				args: parseArgs(fn.arguments),
			};
		});

		const usage = (root.usage ?? {}) as Record<string, unknown>;
		return completion(
			str(message, "content"),
			toolCalls,
			str(first, "finish_reason") || "stop",
			usage.prompt_tokens,
			usage.completion_tokens,
		);
	},
};
