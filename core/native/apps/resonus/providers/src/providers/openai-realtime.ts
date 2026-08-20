/**
 * OpenAI Realtime over WebSocket, text-only.
 *
 * Ported from `src/llm/openai_realtime/protocol.zig`. This is the only
 * descriptor with a handshake and the only one that needs the table's escape
 * hatch, both for reasons documented at the point of use.
 *
 * The gateway owns canonical history, so every response is deliberately
 * out-of-band (`conversation: "none"`): the preconnected socket removes
 * connection latency without also making the vendor the source of truth for the
 * conversation.
 */

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: `${secret:...}`,
// `${env:...}` and `${model}` are the core's substitution syntax, resolved in Zig
// before the request goes out. They are deliberately not template literals: a
// secret must never be interpolated by JavaScript.

import { defineProvider } from "../schema.ts";
import { hooks } from "./openai-realtime.hooks.ts";

export default defineProvider({
	name: "openai-realtime",

	transport: {
		kind: "ws",
		// The vendor holds conversation state on the socket, so a session's
		// connection cannot be handed to another session.
		stateful: true,
		url: "${env:OPENAI_REALTIME_URL:wss://api.openai.com/v1/realtime}?model=${model}",
		headers: { authorization: "Bearer ${secret:openai}" },
		idlePerModel: 3,
		handshake: [
			// WS OPEN is not "session ready": the vendor session comes up in its
			// default audio/server-VAD shape and only reconfigures on an explicit
			// session.update. Handing the socket to the pool before this
			// completes is what let a second turn race a still-audio session.
			{ await: "session.created", timeoutMs: 10000 },
			{ send: "sessionConfig" },
			{ await: "session.updated", timeoutMs: 10000 },
		],
	},

	signaling: {
		url: "${env:OPENAI_REALTIME_CALLS_URL:https://api.openai.com/v1/realtime/calls}",
		headers: { authorization: "Bearer ${secret:openai}" },
		encode: "encodeNegotiation",
		// The reply is an SDP answer, not JSON. The core hands it back verbatim.
		responseKind: "text",
	},

	decode: {
		eventType: "type",
		events: {
			"response.output_text.delta": { emit: "text.delta", text: "delta" },

			"response.function_call_arguments.delta": {
				emit: "tool_call.delta",
				callKey: "call_id",
				id: "call_id",
				name: "name",
				argumentsText: "delta",
			},

			"response.function_call_arguments.done": {
				emit: "tool_call.ready",
				id: "call_id",
				name: "name",
				args: "arguments",
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

			// The only hook on a decode path anywhere. `response.done` needs a
			// filtered walk over `response.output[]` — message items, then
			// output_text parts, concatenated — which a plain dotted path cannot
			// express. It fires once per turn, not per delta, so the JS call is
			// free at this frequency.
			// The hook first, so the turn's values are folded in before the
			// pump is told to stop reading.
			"response.done": [{ emit: "hook", hook: "decodeDone" }, { emit: "turn.end" }],

			error: { emit: "fatal", message: "error.message" },
		},
		unknown: { emit: "ignore" },
	},

	hooks,
});
