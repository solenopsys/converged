/**
 * Runs the built hook bundle through the real QuickJS wrapper.
 *
 * Type-checking proves the hooks compile; this proves they execute in the engine
 * that will actually run them. The two are not the same claim — the bundler
 * targets a browser, and anything it pulled in beyond plain business logic would
 * only fail here.
 */

import {
	CString,
	dlopen,
	FFIType,
	JSCallback,
	type Pointer,
	ptr,
	read,
	suffix,
	write,
} from "bun:ffi";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LIB = resolve(
	import.meta.dir,
	`../../../../wrappers/rt/qjs/zig-out/lib/libqjs.${suffix}`,
);
const BUNDLE = resolve(import.meta.dir, "../dist/hooks.js");

const { symbols, close } = dlopen(LIB, {
	qjs_rt_new: { args: [], returns: FFIType.ptr },
	qjs_rt_free: { args: [FFIType.ptr], returns: FFIType.void },
	qjs_rt_load: {
		args: [
			FFIType.ptr,
			FFIType.ptr,
			FFIType.u64,
			FFIType.ptr,
			FFIType.u64,
			FFIType.ptr,
			FFIType.ptr,
		],
		returns: FFIType.i32,
	},
	qjs_rt_has_fn: {
		args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
		returns: FFIType.i32,
	},
	qjs_rt_call: {
		args: [
			FFIType.ptr,
			FFIType.ptr,
			FFIType.u64,
			FFIType.ptr,
			FFIType.u64,
			FFIType.ptr,
			FFIType.ptr,
		],
		returns: FFIType.i32,
	},
	qjs_free: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.void },
	qjs_rt_set_host_fn: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.void },
	malloc: { args: [FFIType.u64], returns: FFIType.ptr },
});

/**
 * The native `__host` bridge, standing in for the one `registry.zig` installs.
 *
 * Implementing it here means the tests exercise the real path a descriptor
 * takes out of the sandbox, rather than asserting against a stub the production
 * code never uses.
 */
const hostFn = new JSCallback(
	(_user: Pointer | null, arg: Pointer, argLen: number, outPtr: Pointer, outLen: Pointer) => {
		const request = JSON.parse(new CString(arg, 0, argLen).toString());
		if (request.op !== "sha256") return -1;
		const digest = createHash("sha256").update(request.data).digest("hex");

		// The wrapper copies the reply into a JS string and frees it with the C
		// allocator, so it must come from malloc.
		const buf = Buffer.from(digest, "utf8");
		const mem = symbols.malloc(BigInt(buf.length)) as Pointer;
		for (let i = 0; i < buf.length; i++) write.u8(mem, i, buf[i] as number);
		write.ptr(outPtr, 0, mem);
		write.u64(outLen, 0, BigInt(buf.length));
		return 0;
	},
	{
		args: [FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.ptr],
		returns: FFIType.i32,
	},
);

let rt: Pointer | null = null;

const encoder = new TextEncoder();
function bytes(s: string): Uint8Array {
	return encoder.encode(s);
}

/** Reads the (ptr,len) out-params the ABI publishes its result through. */
function takeOutput(outPtr: BigUint64Array, outLen: BigUint64Array): string {
	const p = Number(outPtr[0]) as unknown as Pointer;
	const n = Number(outLen[0]);
	if (!p || n === 0) return "";
	const buf = new Uint8Array(n);
	for (let i = 0; i < n; i++) buf[i] = read.u8(p, i);
	const text = new TextDecoder().decode(buf);
	// The buffer is library-owned; copy out, then hand it straight back.
	symbols.qjs_free(p, BigInt(n));
	return text;
}

function call(fn: string, args: unknown[]): string {
	const name = bytes(fn);
	const arg = bytes(JSON.stringify(args));
	const outPtr = new BigUint64Array(1);
	const outLen = new BigUint64Array(1);
	const code = symbols.qjs_rt_call(
		rt,
		ptr(name),
		BigInt(name.length),
		ptr(arg),
		BigInt(arg.length),
		ptr(outPtr),
		ptr(outLen),
	);
	const text = takeOutput(outPtr, outLen);
	if (code !== 0) throw new Error(`${fn}: ${text}`);
	return text;
}

beforeAll(() => {
	rt = symbols.qjs_rt_new() as Pointer | null;
	expect(rt).toBeTruthy();
	symbols.qjs_rt_set_host_fn(rt, hostFn.ptr, null);

	const source = bytes(readFileSync(BUNDLE, "utf8"));
	const name = bytes("hooks.js");
	const outPtr = new BigUint64Array(1);
	const outLen = new BigUint64Array(1);
	const code = symbols.qjs_rt_load(
		rt,
		ptr(source),
		BigInt(source.length),
		ptr(name),
		BigInt(name.length),
		ptr(outPtr),
		ptr(outLen),
	);
	if (code !== 0)
		throw new Error(`bundle failed to load: ${takeOutput(outPtr, outLen)}`);
});

afterAll(() => {
	if (rt) symbols.qjs_rt_free(rt);
	hostFn.close();
	close();
});

function hasFn(name: string): boolean {
	const b = bytes(name);
	return symbols.qjs_rt_has_fn(rt, ptr(b), BigInt(b.length)) === 1;
}

test("every declared hook is reachable in the runtime", () => {
	const manifest = JSON.parse(
		readFileSync(resolve(import.meta.dir, "../dist/manifest.json"), "utf8"),
	);
	for (const provider of manifest.providers) {
		for (const hook of provider.hooks) {
			expect(`${provider.name}__${hook}`).toSatisfy(hasFn);
		}
	}
});

const TURN = {
	model: "claude-sonnet-4",
	maxTokens: 512,
	messages: [
		{ role: "system", content: "Be terse." },
		{ role: "user", content: "hi" },
	],
	tools: [],
	requireTool: false,
};

test("anthropic encodeTurn lifts the system prompt out of the message list", () => {
	const wire = JSON.parse(call("anthropic__encodeTurn", [TURN, true]));
	const body = JSON.parse(wire.body);
	expect(body.system).toBe("Be terse.");
	expect(body.stream).toBe(true);
	expect(body.max_tokens).toBe(512);
	expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
});

test("anthropic encodeTurn turns a tool result into a tool_result block", () => {
	const wire = JSON.parse(
		call("anthropic__encodeTurn", [
			{
				...TURN,
				messages: [{ role: "tool", content: "42", toolCallId: "call_1" }],
			},
			false,
		]),
	);
	const body = JSON.parse(wire.body);
	expect(body.messages[0]).toEqual({
		role: "user",
		content: [{ type: "tool_result", tool_use_id: "call_1", content: "42" }],
	});
	expect(body.stream).toBeUndefined();
});

test("anthropic decodeResponse folds content blocks into text and calls", () => {
	const decoded = JSON.parse(
		call("anthropic__decodeResponse", [
			{
				content: [
					{ type: "text", text: "one " },
					{ type: "tool_use", id: "t1", name: "clock", input: { tz: "UTC" } },
					{ type: "text", text: "two" },
				],
				stop_reason: "tool_use",
				usage: { input_tokens: 11, output_tokens: 3 },
			},
		]),
	);
	expect(decoded.text).toBe("one two");
	expect(decoded.toolCalls).toEqual([
		{ id: "t1", name: "clock", args: { tz: "UTC" } },
	]);
	expect(decoded.finishReason).toBe("tool_use");
	expect(decoded.usage).toEqual({ input: 11, output: 3 });
});

test("openai encodeTurn keeps the system message in the list", () => {
	const wire = JSON.parse(call("openai__encodeTurn", [TURN, true]));
	const body = JSON.parse(wire.body);
	expect(body.system).toBeUndefined();
	expect(body.messages[0]).toEqual({ role: "system", content: "Be terse." });
	expect(body.stream_options).toEqual({ include_usage: true });
});

test("openai decodeResponse recovers from unparsable tool arguments", () => {
	const decoded = JSON.parse(
		call("openai__decodeResponse", [
			{
				choices: [
					{
						message: {
							content: "",
							tool_calls: [
								{ id: "c1", function: { name: "f", arguments: "{not json" } },
							],
						},
						finish_reason: "tool_calls",
					},
				],
			},
		]),
	);
	expect(decoded.toolCalls[0].args).toEqual({});
	expect(decoded.finishReason).toBe("tool_calls");
});

test("realtime encodeTurn flattens history into out-of-band instructions", () => {
	const wire = JSON.parse(
		call("openai-realtime__encodeTurn", [
			{ ...TURN, tools: [{ name: "clock" }], requireTool: true },
		]),
	);
	const payload = JSON.parse(wire.body);
	expect(payload.type).toBe("response.create");
	expect(payload.response.conversation).toBe("none");
	expect(payload.response.instructions).toBe("[system] Be terse.\n[user] hi\n");
	expect(payload.response.tool_choice).toBe("required");
	expect(payload.response.tools[0].type).toBe("function");
});

test("realtime sessionConfig pins the session to text", () => {
	const payload = JSON.parse(
		JSON.parse(call("openai-realtime__sessionConfig", [])),
	);
	expect(payload.type).toBe("session.update");
	expect(payload.session.output_modalities).toEqual(["text"]);
	expect(payload.session.audio).toBeUndefined();
});

test("realtime decodeDone walks the output array a path cannot address", () => {
	const done = JSON.parse(
		call("openai-realtime__decodeDone", [
			{
				response: {
					output: [
						{
							type: "message",
							content: [{ type: "output_text", text: "hel" }],
						},
						{
							type: "function_call",
							call_id: "c9",
							name: "f",
							arguments: '{"a":1}',
						},
						{ type: "message", content: [{ type: "output_text", text: "lo" }] },
					],
					usage: { input_tokens: 7, output_tokens: 2 },
				},
			},
		]),
	);
	expect(done.events[0]).toEqual({ type: "text.total", text: "hello" });
	expect(done.events[1]).toEqual({
		type: "tool_call.ready",
		id: "c9",
		name: "f",
		args: '{"a":1}',
	});
	expect(done.events[2]).toEqual({
		type: "usage",
		inputTokens: 7,
		outputTokens: 2,
	});
});

test("gemini encodeTurn maps assistant to model and tools to declarations", () => {
	const wire = JSON.parse(
		call("gemini__encodeTurn", [
			{
				...TURN,
				messages: [
					{ role: "system", content: "Be terse." },
					{ role: "assistant", content: "prior" },
				],
				tools: [{ name: "clock", description: "time" }],
			},
		]),
	);
	const body = JSON.parse(wire.body);
	expect(body.systemInstruction).toEqual({ parts: [{ text: "Be terse." }] });
	expect(body.contents[0].role).toBe("model");
	expect(body.tools[0].functionDeclarations[0].name).toBe("clock");
});

// ---- media signaling --------------------------------------------------------
//
// Ported from the deleted `signaling/openai.zig` tests. They now run through the
// real engine against the real bundle, which is a stronger claim than the Zig
// versions made.

const NEGOTIATION = {
	offerSdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n",
	model: "gpt-realtime-2",
	voice: "marin",
	instructions: "Be helpful.",
	sessionKind: "realtime" as const,
	transcription: {
		model: "gpt-transcribe",
		languages: "ru, en",
		prompt: "A support call about a CNC order.",
		keywords: "AC-42, Premium Plus",
	},
	noiseReduction: "far_field",
	vad: { threshold: 0.8, silenceMs: 600, prefixMs: 200, interrupt: true },
};

/** Pull one multipart field back out, so assertions read the real wire bytes. */
function formField(body: string, name: string): string {
	const marker = `name="${name}"\r\n\r\n`;
	const start = body.indexOf(marker) + marker.length;
	return body.slice(start, body.indexOf("\r\n--", start));
}

test("realtime negotiation builds the v2 session config", () => {
	const wire = JSON.parse(call("openai-realtime__encodeNegotiation", [NEGOTIATION]));
	expect(wire.contentType).toStartWith("multipart/form-data; boundary=resonus-");

	expect(formField(wire.body, "sdp")).toBe(NEGOTIATION.offerSdp);
	const session = JSON.parse(formField(wire.body, "session"));

	expect(session.type).toBe("realtime");
	expect(session.model).toBe("gpt-realtime-2");
	expect(session.output_modalities).toEqual(["audio"]);
	expect(session.audio.output.voice).toBe("marin");
	expect(session.audio.input.noise_reduction).toEqual({ type: "far_field" });
	expect(session.audio.input.turn_detection).toEqual({
		type: "server_vad",
		threshold: 0.8,
		prefix_padding_ms: 200,
		silence_duration_ms: 600,
		create_response: true,
		interrupt_response: true,
	});
	// Comma-separated settings become arrays; the items are trimmed.
	expect(session.audio.input.transcription).toEqual({
		model: "gpt-transcribe",
		languages: ["ru", "en"],
		prompt: "A support call about a CNC order.",
		keywords: ["AC-42", "Premium Plus"],
	});
});

test("empty transcription settings are omitted, not sent empty", () => {
	const wire = JSON.parse(
		call("openai-realtime__encodeNegotiation", [
			{ ...NEGOTIATION, transcription: { model: "gpt-transcribe", languages: "" } },
		]),
	);
	const session = JSON.parse(formField(wire.body, "session"));
	expect(session.audio.input.transcription).toEqual({ model: "gpt-transcribe" });
});

test("noise reduction off sends null, which the vendor requires", () => {
	for (const value of ["", "null", "none", "off", "  "]) {
		const wire = JSON.parse(
			call("openai-realtime__encodeNegotiation", [{ ...NEGOTIATION, noiseReduction: value }]),
		);
		const session = JSON.parse(formField(wire.body, "session"));
		expect(session.audio.input.noise_reduction).toBeNull();
	}
});

test("a transcription session carries no instructions, model or voice", () => {
	const wire = JSON.parse(
		call("openai-realtime__encodeNegotiation", [
			{ ...NEGOTIATION, sessionKind: "transcription", instructions: "" },
		]),
	);
	const session = JSON.parse(formField(wire.body, "session"));
	expect(session.type).toBe("transcription");
	expect(session.model).toBeUndefined();
	expect(session.instructions).toBeUndefined();
	expect(session.audio.output).toBeUndefined();
	// No responses on this leg, so no create_response either.
	expect(session.audio.input.turn_detection.create_response).toBeUndefined();
});

test("a malformed keyword is a configuration error, not sanitised away", () => {
	expect(() =>
		call("openai-realtime__encodeNegotiation", [
			{
				...NEGOTIATION,
				transcription: { model: "gpt-transcribe", languages: "ru", keywords: "good, <bad>" },
			},
		]),
	).toThrow(/invalid transcription keyword/);
});

test("the multipart boundary is derived from the content", () => {
	const a = JSON.parse(call("openai-realtime__encodeNegotiation", [NEGOTIATION]));
	const b = JSON.parse(call("openai-realtime__encodeNegotiation", [NEGOTIATION]));
	const c = JSON.parse(
		call("openai-realtime__encodeNegotiation", [{ ...NEGOTIATION, voice: "cedar" }]),
	);
	// Same input, same delimiter; different input, different delimiter — and it
	// can never appear inside what it delimits.
	expect(a.contentType).toBe(b.contentType);
	expect(c.contentType).not.toBe(a.contentType);
	expect(a.body).not.toContain(`${a.contentType.split("boundary=")[1]}x`);
});

test("the safety identifier travels as a header when present", () => {
	const without = JSON.parse(call("openai-realtime__encodeNegotiation", [NEGOTIATION]));
	expect(without.headers).toEqual({});

	const with_id = JSON.parse(
		call("openai-realtime__encodeNegotiation", [{ ...NEGOTIATION, safetyIdentifier: "abc123" }]),
	);
	expect(with_id.headers).toEqual({ "OpenAI-Safety-Identifier": "abc123" });
});

test("gemini negotiates with a bare SDP body", () => {
	const wire = JSON.parse(call("gemini__encodeNegotiation", [NEGOTIATION]));
	expect(wire.contentType).toBe("application/sdp");
	expect(wire.body).toBe(NEGOTIATION.offerSdp);
});
