/**
 * Warm hooks for `gemini` — the business logic, and nothing else.
 *
 * This file is the only part of the provider that is bundled into the QuickJS
 * runtime script. It imports types and shared logic alone, so nothing survives
 * compilation but the functions themselves. The descriptor next to it holds the
 * transport and decode table, which the core reads as data.
 */

import { completion, EMPTY_SCHEMA, joinSystem, str } from "../core.ts";
import type {
	NegotiationContext,
	TurnRequest,
	UniformMessage,
	UniformTool,
	WireRequest,
} from "../schema.ts";

function encodeContent(m: UniformMessage): unknown {
	const content = m.content ?? "";

	// A tool result is a user turn with one functionResponse part.
	if (m.role === "tool") {
		return {
			role: "user",
			parts: [
				{
					functionResponse: {
						name: m.name ?? "",
						response: { result: content },
					},
				},
			],
		};
	}

	const calls = m.role === "assistant" ? (m.toolCalls ?? []) : [];
	if (calls.length > 0) {
		const parts: unknown[] = [];
		if (content.length > 0) parts.push({ text: content });
		for (const call of calls) {
			parts.push({
				functionCall: { name: call.name ?? "", args: call.args ?? {} },
			});
		}
		return { role: "model", parts };
	}

	return {
		role: m.role === "assistant" ? "model" : "user",
		parts: [{ text: content }],
	};
}

function encodeTool(t: UniformTool): unknown {
	return {
		name: t.name,
		description: t.description ?? "",
		parameters: t.parameters ?? EMPTY_SCHEMA,
	};
}

export const hooks = {
	/**
	 * Gemini exchanges a bare SDP offer for a bare answer — no envelope, no
	 * session config alongside it.
	 */
	encodeNegotiation(ctx: NegotiationContext): WireRequest {
		return { method: "POST", contentType: "application/sdp", body: ctx.offerSdp };
	},

	encodeTurn(req: TurnRequest): WireRequest {
		const system = joinSystem(req.messages);
		const generationConfig: Record<string, unknown> = {
			maxOutputTokens: req.maxTokens,
		};
		if (req.temperature !== undefined)
			generationConfig.temperature = req.temperature;

		const body: Record<string, unknown> = {
			contents: req.messages
				.filter((m) => m.role !== "system")
				.map(encodeContent),
			generationConfig,
		};
		if (system !== undefined)
			body.systemInstruction = { parts: [{ text: system }] };
		if (req.tools.length > 0)
			body.tools = [{ functionDeclarations: req.tools.map(encodeTool) }];

		return { method: "POST", body: JSON.stringify(body) };
	},

	decodeResponse(raw: unknown) {
		const root = raw as Record<string, unknown>;
		const candidates = (
			Array.isArray(root.candidates) ? root.candidates : []
		) as Record<string, unknown>[];
		const first = (candidates[0] ?? {}) as Record<string, unknown>;
		const content = (first.content ?? {}) as Record<string, unknown>;
		const parts = (Array.isArray(content.parts) ? content.parts : []) as Record<
			string,
			unknown
		>[];

		let text = "";
		const toolCalls: { id: string; name: string; args: unknown }[] = [];
		for (const part of parts) {
			text += str(part, "text");
			const call = part.functionCall as Record<string, unknown> | undefined;
			if (call) {
				// Gemini issues no call ids; the name is the only correlator
				// available, and the uniform model requires one.
				const name = str(call, "name");
				toolCalls.push({ id: name, name, args: call.args ?? {} });
			}
		}

		const usage = (root.usageMetadata ?? {}) as Record<string, unknown>;
		return completion(
			text,
			toolCalls,
			str(first, "finishReason") || "STOP",
			usage.promptTokenCount,
			usage.candidatesTokenCount,
		);
	},
};
