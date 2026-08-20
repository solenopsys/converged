/**
 * Shared business logic for descriptors.
 *
 * Only what is genuinely the same across vendors lives here. That is a short
 * list, and keeping it short is the point: a "core" module in a plugin system
 * attracts anything that looks vaguely reusable, and once vendor A's quirk is
 * behind a flag in a shared function, vendor B's quirk gets a second flag and
 * the descriptors stop being readable on their own.
 *
 * What is deliberately *not* here: `encodeTool` and `encodeMessage`. They differ
 * in every provider — Anthropic nests a tool's schema under `input_schema`,
 * OpenAI under `function.parameters`, Gemini declares it flat — and unifying
 * them would mean a shared function with a switch on the caller, which is the
 * same coupling the descriptors exist to remove, only harder to see.
 *
 * This file is bundled into the runtime script, so it holds logic and nothing
 * else: no I/O, no dependencies, types only at the boundary.
 */

import type { UniformMessage } from "./schema.ts";

/**
 * Native host bridge. The core installs it on every runtime; it is the only way
 * out of the sandbox and carries no I/O — just operations that would be wasteful
 * or wrong to reimplement in JavaScript.
 */
declare const __host: (request: string) => string;

/**
 * SHA-256 of `text`, lowercase hex.
 *
 * Done natively rather than in JavaScript: hashing is exactly the kind of heavy,
 * fixed work that belongs on the Zig side, and a descriptor should stay readable
 * as business logic.
 */
export function sha256(text: string): string {
	const digest = __host(JSON.stringify({ op: "sha256", data: text }));
	// An unavailable host bridge returns "", which would silently produce an
	// empty multipart boundary — a body the vendor rejects for reasons that
	// point nowhere near the cause.
	if (!/^[0-9a-f]{64}$/.test(digest)) {
		throw new Error("__host sha256 unavailable or malformed");
	}
	return digest;
}

/**
 * A multipart/form-data body whose boundary is derived from the content.
 *
 * Deriving it means the delimiter cannot collide with what it delimits, which a
 * random boundary only makes unlikely.
 */
export function multipart(fields: [string, string][]): { contentType: string; body: string } {
	const boundary = `resonus-${sha256(fields.map(([, v]) => v).join("\u0000")).slice(0, 32)}`;
	let body = "";
	for (const [name, value] of fields) {
		body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
	}
	body += `--${boundary}--\r\n`;
	return { contentType: `multipart/form-data; boundary=${boundary}`, body };
}

/**
 * A comma-separated setting as a list of trimmed, non-empty items.
 *
 * Empty yields an empty list, and the caller omits the key rather than sending
 * `[]`: to some vendors an empty array is a different request than an absent
 * field.
 */
export function list(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

/** A tool schema when the caller declared none. Vendors reject an absent one. */
export const EMPTY_SCHEMA = { type: "object", properties: {} } as const;

/**
 * Every system message, joined with a blank line.
 *
 * For the providers that carry the system prompt outside the message list —
 * Anthropic's top-level `system`, Gemini's `systemInstruction`. Returns
 * undefined rather than an empty string when there is none, so the caller omits
 * the key instead of sending it empty: to some vendors those are different
 * requests.
 */
export function joinSystem(messages: UniformMessage[]): string | undefined {
	const parts = messages
		.filter((m) => m.role === "system")
		.map((m) => m.content ?? "");
	return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export interface UniformToolCall {
	id: string;
	name: string;
	args: unknown;
}

export interface UniformCompletion {
	text: string;
	toolCalls: UniformToolCall[];
	finishReason: string;
	usage: { input: number; output: number };
}

/**
 * Build the uniform completion every `decodeResponse` returns.
 *
 * Constructing this shape by hand in each provider is how the providers drift
 * apart: a missing `usage` in one of them is invisible until something
 * downstream reads a zero that should have been a number. One constructor means
 * the shape is defined once and the vendor code only supplies the values.
 */
export function completion(
	text: string,
	toolCalls: UniformToolCall[],
	finishReason: string,
	input: unknown,
	output: unknown,
): UniformCompletion {
	return {
		text,
		toolCalls,
		finishReason,
		usage: { input: Number(input ?? 0), output: Number(output ?? 0) },
	};
}

/** Read a string field, or "" — vendors omit empty strings rather than send them. */
export function str(source: Record<string, unknown>, key: string): string {
	const value = source[key];
	return typeof value === "string" ? value : "";
}

/**
 * Parse vendor-sent tool arguments, which arrive as JSON *text*.
 *
 * A truncated or malformed argument string is a real occurrence on a cut-off
 * stream. An empty object is a better turn than a thrown exception that loses
 * the assistant's text along with it.
 */
export function parseArgs(text: unknown): unknown {
	if (typeof text !== "string" || text.length === 0) return {};
	try {
		return JSON.parse(text);
	} catch {
		return {};
	}
}
