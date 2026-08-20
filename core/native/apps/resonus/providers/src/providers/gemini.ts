/**
 * Google Gemini `generateContent` (non-streaming).
 *
 * Ported from `src/llm/gemini.zig`. Roles are user/model rather than
 * user/assistant, tool traffic travels as functionCall / functionResponse parts,
 * and the system prompt is a top-level `systemInstruction`.
 *
 * The Zig adapter never implemented streaming, so this descriptor has no decode
 * table beyond the terminal shape: `always` is absent and only `decodeResponse`
 * is used. Adding `streamGenerateContent` later is a table, not a code change.
 */

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: `${secret:...}`,
// `${env:...}` and `${model}` are the core's substitution syntax, resolved in Zig
// before the request goes out. They are deliberately not template literals: a
// secret must never be interpolated by JavaScript.

import { defineProvider } from "../schema.ts";
import { hooks } from "./gemini.hooks.ts";

export default defineProvider({
	name: "gemini",

	transport: {
		kind: "https",
		stateful: false,
		url: "${env:RT_GEMINI_BASE_URL:https://generativelanguage.googleapis.com/v1beta}/models/${model}:generateContent",
		headers: {
			"content-type": "application/json",
			"x-goog-api-key": "${secret:gemini}",
		},
	},

	signaling: {
		url: "${env:GEMINI_SDP_URL:}?model=${model}",
		headers: { "x-goog-api-key": "${secret:gemini}" },
		encode: "encodeNegotiation",
		responseKind: "text",
	},

	decode: {
		// No streaming endpoint is wired up; the turn is decoded whole.
		always: { emit: "ignore" },
	},

	hooks,
});
