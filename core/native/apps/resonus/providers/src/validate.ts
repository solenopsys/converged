/**
 * Build-time validation of a descriptor.
 *
 * The core refuses to load a descriptor it cannot fully understand, so every
 * mistake this catches would otherwise surface as a startup failure — or worse,
 * as a vendor 400 in production. Catching it in the builder keeps the loud
 * failure where it is cheapest to read.
 */

import {
	API_VERSION,
	type DecodeTable,
	type Descriptor,
	type Emit,
	type Path,
	type Rule,
	type Transport,
} from "./schema.ts";

export class DescriptorError extends Error {
	constructor(
		readonly provider: string,
		readonly where: string,
		message: string,
	) {
		super(`${provider}: ${where}: ${message}`);
		this.name = "DescriptorError";
	}
}

const PATH_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z0-9_$]+)*$/;

/** Emit kinds and the path fields each one requires. */
const REQUIRED: Record<string, string[]> = {
	"text.delta": ["text"],
	"tool_call.begin": ["callKey"],
	"tool_call.delta": ["callKey", "argumentsText"],
	"tool_call.ready": ["id", "name", "args"],
	usage: [],
	finish: [],
	fatal: [],
	"turn.end": [],
	ignore: [],
	hook: [],
};

/** Path fields that are optional but must still be well formed when present. */
const OPTIONAL: Record<string, string[]> = {
	"text.delta": [],
	"tool_call.begin": ["id", "name"],
	"tool_call.delta": ["id", "name"],
	"tool_call.ready": [],
	usage: ["inputTokens", "outputTokens"],
	finish: ["finishReason"],
	fatal: ["message"],
	"turn.end": [],
	ignore: [],
	hook: [],
};

export interface ValidationResult {
	/** Hook names the decode table references, for cross-checking with `hooks`. */
	referencedHooks: string[];
}

export function validate(
	d: Descriptor,
	expectedName?: string,
): ValidationResult {
	const name = d.name ?? "<unnamed>";
	const fail = (where: string, message: string): never => {
		throw new DescriptorError(name, where, message);
	};

	if (d.apiVersion !== API_VERSION) {
		fail("apiVersion", `expected ${API_VERSION}, got ${String(d.apiVersion)}`);
	}
	if (typeof d.name !== "string" || d.name.length === 0) {
		fail("name", "must be a non-empty string");
	}
	if (expectedName !== undefined && d.name !== expectedName) {
		fail("name", `must match its file name "${expectedName}"`);
	}

	validateTransport(d.transport, fail);

	const referenced: string[] = [];
	if (d.signaling) {
		const sig = d.signaling;
		if (typeof sig.url !== "string" || sig.url.length === 0) {
			fail("signaling.url", "must be a non-empty string");
		}
		if (sig.responseKind !== "text" && sig.responseKind !== "json") {
			fail("signaling.responseKind", 'expected "text" or "json"');
		}
		if (typeof sig.encode !== "string" || sig.encode.length === 0) {
			fail("signaling.encode", "must name a hook");
		} else {
			referenced.push(sig.encode);
		}
	}
	validateDecode(d.decode, referenced, fail);

	const hooks = d.hooks ?? {};
	for (const hook of referenced) {
		if (typeof hooks[hook] !== "function") {
			fail(
				"decode",
				`references hook "${hook}", which is not exported in hooks`,
			);
		}
	}
	for (const [hook, impl] of Object.entries(hooks)) {
		if (typeof impl !== "function") {
			fail(`hooks.${hook}`, "must be a function");
		}
	}

	return { referencedHooks: referenced };
}

type Fail = (where: string, message: string) => never;

function validateTransport(t: Transport | undefined, fail: Fail): void {
	if (!t) fail("transport", "is required");
	if (t.kind !== "ws" && t.kind !== "https") {
		fail(
			"transport.kind",
			`expected "ws" or "https", got ${JSON.stringify(t.kind)}`,
		);
	}
	if (typeof t.stateful !== "boolean") {
		// Not defaulted on purpose: whether a connection carries conversation
		// state decides if the pool may hand it to a different session, and
		// guessing that wrong is a cross-session data leak, not a slow path.
		fail("transport.stateful", "must be stated explicitly (true or false)");
	}
	if (typeof t.url !== "string" || t.url.length === 0) {
		fail("transport.url", "must be a non-empty string");
	}
	if (t.kind === "https" && t.handshake && t.handshake.length > 0) {
		fail(
			"transport.handshake",
			'is only meaningful for a session transport (kind: "ws")',
		);
	}
	for (const [i, step] of (t.handshake ?? []).entries()) {
		const isAwait = "await" in step && typeof step.await === "string";
		const isSend = "send" in step && typeof step.send === "string";
		if (isAwait === isSend) {
			fail(
				`transport.handshake[${i}]`,
				'must have exactly one of "await" or "send"',
			);
		}
	}
	if (t.idlePerModel !== undefined) {
		if (
			!Number.isInteger(t.idlePerModel) ||
			t.idlePerModel < 1 ||
			t.idlePerModel > 16
		) {
			fail("transport.idlePerModel", "must be an integer in 1..16");
		}
	}
}

function validateDecode(
	decode: DecodeTable | undefined,
	referenced: string[],
	fail: Fail,
): void {
	if (!decode) fail("decode", "is required");
	if (!decode.events && !decode.always) {
		fail("decode", 'needs at least one of "events" or "always"');
	}
	if (decode.events && !decode.eventType) {
		fail("decode.eventType", 'is required when "events" is present');
	}
	if (decode.eventType) checkPath(decode.eventType, "decode.eventType", fail);

	for (const [type, rule] of Object.entries(decode.events ?? {})) {
		walkRule(rule, `decode.events[${JSON.stringify(type)}]`, referenced, fail);
	}
	if (decode.always) walkRule(decode.always, "decode.always", referenced, fail);
	if (decode.unknown)
		walkRule(decode.unknown, "decode.unknown", referenced, fail);
}

function walkRule(
	rule: Rule,
	where: string,
	referenced: string[],
	fail: Fail,
): void {
	if (Array.isArray(rule)) {
		if (rule.length === 0) fail(where, "empty rule list");
		for (const [i, item] of rule.entries())
			walkRule(item, `${where}[${i}]`, referenced, fail);
		return;
	}
	if ("each" in rule) {
		checkPath(rule.each, `${where}.each`, fail);
		walkRule(rule.rule, `${where}.rule`, referenced, fail);
		return;
	}
	if ("when" in rule) {
		checkPath(rule.when, `${where}.when`, fail);
		const cases = Object.entries(rule.cases ?? {});
		if (cases.length === 0)
			fail(`${where}.cases`, "must have at least one case");
		for (const [value, sub] of cases) {
			walkRule(
				sub,
				`${where}.cases[${JSON.stringify(value)}]`,
				referenced,
				fail,
			);
		}
		if (rule.default)
			walkRule(rule.default, `${where}.default`, referenced, fail);
		return;
	}
	validateEmit(rule, where, referenced, fail);
}

function validateEmit(
	emit: Emit,
	where: string,
	referenced: string[],
	fail: Fail,
): void {
	const required = REQUIRED[emit.emit];
	if (!required) {
		fail(where, `unknown emit kind ${JSON.stringify(emit.emit)}`);
	}
	const record = emit as unknown as Record<string, unknown>;

	for (const field of required) {
		const value = record[field];
		if (typeof value !== "string") fail(`${where}.${field}`, "is required");
		checkPath(value as Path, `${where}.${field}`, fail);
	}
	for (const field of OPTIONAL[emit.emit] ?? []) {
		const value = record[field];
		if (value === undefined) continue;
		if (typeof value !== "string")
			fail(`${where}.${field}`, "must be a path string");
		checkPath(value as Path, `${where}.${field}`, fail);
	}

	if (emit.emit === "hook") {
		if (typeof emit.hook !== "string" || emit.hook.length === 0) {
			fail(`${where}.hook`, "must name a hook");
		}
		referenced.push(emit.hook);
	}
	if (emit.emit === "usage" && !emit.inputTokens && !emit.outputTokens) {
		fail(where, "usage needs at least one of inputTokens or outputTokens");
	}

	const known = new Set([
		"emit",
		...required,
		...(OPTIONAL[emit.emit] ?? []),
		...(emit.emit === "hook" ? ["hook"] : []),
	]);
	for (const key of Object.keys(record)) {
		// A typo in an optional field would otherwise be silently dropped and
		// show up as a missing value at runtime, far from its cause.
		if (!known.has(key))
			fail(`${where}.${key}`, "is not a field of this emit kind");
	}
}

function checkPath(path: string, where: string, fail: Fail): void {
	if (typeof path !== "string" || path.length === 0)
		fail(where, "must be a non-empty path");
	if (!PATH_RE.test(path)) {
		fail(
			where,
			`${JSON.stringify(path)} is not a plain dotted path; filters and wildcards belong in a hook`,
		);
	}
}
