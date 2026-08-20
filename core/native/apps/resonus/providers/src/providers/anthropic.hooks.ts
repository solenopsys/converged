/**
 * Warm hooks for `anthropic` — the business logic, and nothing else.
 *
 * This file is the only part of the provider that is bundled into the QuickJS
 * runtime script. It imports types and shared logic alone, so nothing survives
 * compilation but the functions themselves. The descriptor next to it holds the
 * transport and decode table, which the core reads as data.
 */

import { completion, EMPTY_SCHEMA, joinSystem, str } from "../core.ts";
import type {
	TurnRequest,
	UniformMessage,
	UniformTool,
	WireRequest,
} from "../schema.ts";

function encodeTool(t: UniformTool): unknown {
	return {
		name: t.name ?? "",
		description: t.description ?? "",
		input_schema: t.parameters ?? EMPTY_SCHEMA,
	};
}

function encodeMessage(m: UniformMessage): unknown {
	const content = m.content ?? "";

	// A tool result is a user turn holding one tool_result block.
	if (m.role === "tool") {
		return {
			role: "user",
			content: [
				{ type: "tool_result", tool_use_id: m.toolCallId ?? "", content },
			],
		};
	}

	// An assistant turn that called tools becomes text + tool_use blocks.
	const calls = m.role === "assistant" ? (m.toolCalls ?? []) : [];
	if (calls.length > 0) {
		const blocks: unknown[] = [];
		if (content.length > 0) blocks.push({ type: "text", text: content });
		for (const call of calls) {
			blocks.push({
				type: "tool_use",
				id: call.id ?? "",
				name: call.name ?? "",
				input: call.args ?? {},
			});
		}
		return { role: "assistant", content: blocks };
	}

	return { role: m.role === "assistant" ? "assistant" : "user", content };
}

export const hooks = {
	encodeTurn(req: TurnRequest, stream: boolean): WireRequest {
		const system = joinSystem(req.messages);
		const body: Record<string, unknown> = {
			model: req.model,
			max_tokens: req.maxTokens,
			messages: req.messages
				.filter((m) => m.role !== "system")
				.map(encodeMessage),
		};
		if (stream) body.stream = true;
		if (req.temperature !== undefined) body.temperature = req.temperature;
		if (system !== undefined) body.system = system;
		if (req.tools.length > 0) body.tools = req.tools.map(encodeTool);

		return { method: "POST", body: JSON.stringify(body) };
	},

	/** Non-streaming reply: content blocks fold into text plus tool calls. */
	decodeResponse(raw: unknown) {
		const root = raw as Record<string, unknown>;
		const blocks = (Array.isArray(root.content) ? root.content : []) as Record<
			string,
			unknown
		>[];

		let text = "";
		const toolCalls: { id: string; name: string; args: unknown }[] = [];
		for (const block of blocks) {
			if (block.type === "text") {
				text += str(block, "text");
			} else if (block.type === "tool_use") {
				// Anthropic sends tool input already parsed, not as JSON text.
				toolCalls.push({
					id: str(block, "id"),
					name: str(block, "name"),
					args: block.input ?? {},
				});
			}
		}

		const usage = (root.usage ?? {}) as Record<string, unknown>;
		return completion(
			text,
			toolCalls,
			str(root, "stop_reason") || "end_turn",
			usage.input_tokens,
			usage.output_tokens,
		);
	},
};
