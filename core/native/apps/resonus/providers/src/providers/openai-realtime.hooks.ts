/**
 * Warm hooks for `openai-realtime` — the business logic, and nothing else.
 *
 * This file is the only part of the provider that is bundled into the QuickJS
 * runtime script. It imports types and shared logic alone, so nothing survives
 * compilation but the functions themselves. The descriptor next to it holds the
 * transport, handshake and decode table, which the core reads as data.
 */

import { EMPTY_SCHEMA, list, multipart, str } from "../core.ts";
import type { NegotiationContext, TurnRequest, UniformTool, WireRequest } from "../schema.ts";

/**
 * Sessions come up as `output_modalities:["audio"]` with server VAD. Pin the
 * session to text once at connect time rather than relying on the per-response
 * override alone.
 *
 * The GA schema requires `audio.input` to carry format/transcription/noise
 * reduction together; a partial `audio.input` is what the server rejected with a
 * bare connection close and no `error` event. With `output_modalities:["text"]`
 * there is no audio leg to configure, so `audio` is omitted entirely.
 */
const SESSION_UPDATE = JSON.stringify({
	type: "session.update",
	session: { type: "realtime", output_modalities: ["text"] },
});

/** Realtime takes the same tool shape as chat, but every item must be typed. */
function encodeTool(t: UniformTool): unknown {
	return {
		type: "function",
		name: t.name,
		description: t.description ?? "",
		parameters: t.parameters ?? EMPTY_SCHEMA,
	};
}

/**
 * `"transcription":{...}` — the GPT-Transcribe input config.
 *
 * Optional fields are omitted rather than sent empty. Keywords carry an API-side
 * format rule (single line, no angle brackets); a violation is a configuration
 * error, so it throws instead of being sanitised away.
 */
function transcriptionConfig(t: NegotiationContext["transcription"]): Record<string, unknown> {
	const config: Record<string, unknown> = { model: t.model };

	const languages = list(t.languages);
	if (languages.length > 0) config.languages = languages;
	if (t.prompt) config.prompt = t.prompt;

	const keywords = list(t.keywords);
	if (keywords.length > 0) {
		for (const keyword of keywords) {
			if (/[<>\r\n]/.test(keyword)) {
				throw new Error(`invalid transcription keyword: ${JSON.stringify(keyword)}`);
			}
		}
		config.keywords = keywords;
	}
	if (t.delay) config.delay = t.delay;
	return config;
}

/** `null` disables it; the vendor rejects an empty object here. */
function noiseReduction(value: string): unknown {
	const trimmed = (value ?? "").trim();
	if (trimmed === "" || trimmed === "null" || trimmed === "none" || trimmed === "off") return null;
	return { type: trimmed };
}

export const hooks = {
	encodeTurn(req: TurnRequest): WireRequest {
		const instructions = req.messages
			.map((m) => `[${m.role ?? "user"}] ${m.content ?? ""}\n`)
			.join("");
		const tools = req.tools
			.filter((t) => (t.name ?? "").length > 0)
			.map(encodeTool);

		const response: Record<string, unknown> = {
			conversation: "none",
			output_modalities: ["text"],
			max_output_tokens: req.maxTokens,
			instructions,
			tools,
		};
		if (req.requireTool && tools.length > 0) response.tool_choice = "required";

		return { body: JSON.stringify({ type: "response.create", response }) };
	},

	/**
	 * SDP offer -> the multipart body `/v1/realtime/calls` expects.
	 *
	 * Two session shapes share the transport. A `transcription` session has no
	 * instructions, no voice and no responses: the server only transcribes the
	 * inbound track. A `realtime` one is the full duplex session.
	 */
	encodeNegotiation(ctx: NegotiationContext): WireRequest {
		const audioInput: Record<string, unknown> = {
			noise_reduction: noiseReduction(ctx.noiseReduction),
			turn_detection:
				ctx.sessionKind === "realtime"
					? {
							type: "server_vad",
							threshold: ctx.vad.threshold,
							prefix_padding_ms: ctx.vad.prefixMs,
							silence_duration_ms: ctx.vad.silenceMs,
							create_response: true,
							interrupt_response: ctx.vad.interrupt,
						}
					: {
							type: "server_vad",
							threshold: ctx.vad.threshold,
							prefix_padding_ms: ctx.vad.prefixMs,
							silence_duration_ms: ctx.vad.silenceMs,
						},
			transcription: transcriptionConfig(ctx.transcription),
		};

		let session: Record<string, unknown>;
		if (ctx.sessionKind === "transcription") {
			session = { type: "transcription", audio: { input: audioInput } };
		} else {
			session = {
				type: "realtime",
				model: ctx.model,
				instructions: ctx.instructions,
				output_modalities: ["audio"],
				audio: { input: audioInput, output: { voice: ctx.voice } },
			};
			if (ctx.toolsJson) {
				session.tools = JSON.parse(ctx.toolsJson);
				session.tool_choice = "auto";
			}
		}

		const form = multipart([
			["sdp", ctx.offerSdp],
			["session", JSON.stringify(session)],
		]);
		const headers: Record<string, string> = {};
		if (ctx.safetyIdentifier) headers["OpenAI-Safety-Identifier"] = ctx.safetyIdentifier;

		return { method: "POST", contentType: form.contentType, headers, body: form.body };
	},

	/** Payload for the handshake's `send` step. */
	sessionConfig(): string {
		return SESSION_UPDATE;
	},

	/**
	 * `response.done` -> the turn's text, tool calls and usage.
	 *
	 * Unlike the other providers' `decodeResponse`, this returns decode-table
	 * events rather than a completion: it is reached from the table's escape
	 * hatch mid-stream, and the core folds these into the same accumulator the
	 * table feeds.
	 */
	decodeDone(raw: unknown) {
		const root = raw as Record<string, unknown>;
		const response = (root.response ?? {}) as Record<string, unknown>;
		const output = (
			Array.isArray(response.output) ? response.output : []
		) as Record<string, unknown>[];

		let text = "";
		const toolCalls: { id: string; name: string; args: string }[] = [];
		for (const item of output) {
			if (item.type === "message") {
				const content = (
					Array.isArray(item.content) ? item.content : []
				) as Record<string, unknown>[];
				for (const part of content) {
					if (part.type === "output_text") text += str(part, "text");
				}
			} else if (item.type === "function_call") {
				// Arguments stay JSON text here; the core splices them verbatim.
				toolCalls.push({
					id: str(item, "call_id"),
					name: str(item, "name"),
					args: str(item, "arguments") || "{}",
				});
			}
		}

		const usage = (response.usage ?? {}) as Record<string, unknown>;
		return {
			events: [
				{ type: "text.total", text },
				...toolCalls.map((c) => ({ type: "tool_call.ready", ...c })),
				{
					type: "usage",
					inputTokens: Number(usage.input_tokens ?? 0),
					outputTokens: Number(usage.output_tokens ?? 0),
				},
				{ type: "finish", finishReason: "stop" },
			],
		};
	},
};
