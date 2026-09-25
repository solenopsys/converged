/** Request and response mapping for OpenAI Responses API. */

import { completion, EMPTY_SCHEMA, joinSystem, parseArgs, str } from "../core.ts";
import type { TurnRequest, UniformMessage, UniformTool } from "../schema.ts";

function encodeTool(tool: UniformTool): unknown {
	return {
		type: "function",
		name: tool.name,
		description: tool.description ?? "",
		parameters: tool.parameters ?? EMPTY_SCHEMA,
	};
}

function encodeMessage(message: UniformMessage): unknown {
	if (message.role === "tool") {
		return {
			type: "function_call_output",
			call_id: message.toolCallId ?? "",
			output: message.content ?? "",
		};
	}

	if (message.role === "assistant" && message.toolCalls?.length) {
		const items: unknown[] = [];
		if (message.content) {
			items.push({ role: "assistant", content: message.content });
		}
		for (const call of message.toolCalls) {
			items.push({
				type: "function_call",
				call_id: call.id ?? "",
				name: call.name ?? "",
				arguments: JSON.stringify(call.args ?? {}),
			});
		}
		return items;
	}

	return { role: message.role, content: message.content ?? "" };
}

function outputItems(response: Record<string, unknown>): Record<string, unknown>[] {
	return (Array.isArray(response.output) ? response.output : []) as Record<string, unknown>[];
}

function decode(raw: unknown) {
	const root = raw as Record<string, unknown>;
	const response = (root.response ?? root) as Record<string, unknown>;
	let text = "";
	const toolCalls: { id: string; name: string; args: unknown }[] = [];
	for (const item of outputItems(response)) {
		if (item.type === "message") {
			const content = (Array.isArray(item.content) ? item.content : []) as Record<string, unknown>[];
			for (const part of content) if (part.type === "output_text") text += str(part, "text");
		} else if (item.type === "function_call") {
			toolCalls.push({ id: str(item, "call_id"), name: str(item, "name"), args: parseArgs(item.arguments) });
		}
	}
	const usage = (response.usage ?? {}) as Record<string, unknown>;
	return completion(text, toolCalls, str(response, "status") || "completed", usage.input_tokens, usage.output_tokens);
}

export const hooks = {
	openSession() {
		return { path: "/conversations", body: "{}" };
	},

	decodeSession(_request: unknown, raw: unknown) {
		const response = raw as Record<string, unknown>;
		if (typeof response.id !== "string" || response.id.length === 0) {
			throw new Error("OpenAI did not return a conversation id");
		}
		return { conversationId: response.id };
	},

	closeSession(_request: unknown, raw: unknown) {
		const session = raw as { conversationId?: string };
		if (!session.conversationId) throw new Error("OpenAI conversation id is missing");
		return {
			method: "DELETE",
			path: `/conversations/${encodeURIComponent(session.conversationId)}`,
			body: "",
		};
	},

	encodeTurn(req: TurnRequest, stream: boolean) {
		const body: Record<string, unknown> = {
			model: req.model,
			max_output_tokens: req.maxTokens,
			input: req.messages
				.filter((message) => message.role !== "system")
				.flatMap(encodeMessage),
		};
		const instructions = joinSystem(req.messages);
		if (instructions) body.instructions = instructions;
		const session = req.session as { conversationId?: string } | undefined;
		if (session?.conversationId) body.conversation = session.conversationId;
		if (req.tools.length > 0) {
			body.tools = req.tools.map(encodeTool);
			if (req.requireTool) body.tool_choice = "required";
		}
		if (stream) body.stream = true;
		if (req.temperature !== undefined) body.temperature = req.temperature;

		return { path: "/responses", body: JSON.stringify(body) };
	},

	decodeResponse(raw: unknown) {
		return decode(raw);
	},
};
