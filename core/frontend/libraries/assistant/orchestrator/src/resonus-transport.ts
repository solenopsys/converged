import type { ResonusCommandTransport } from "./resonus-session";

// Maps an NRPC envelope channel to the command port the session and the chat
// driver speak. Both hosts have such a channel — the browser over its socket,
// the CLI over Fujin — so neither needs its own copy of this mapping.

export type CommandEnvelope = {
	kind: "request";
	requestId: string;
	to: { target: string; service: string };
	method: string;
	codec: "json";
	deadlineMs: number;
	payload: unknown;
};

export type EnvelopeReply = {
	kind?: unknown;
	payload?: unknown;
	error?: unknown;
	errorCode?: unknown;
};

export type EnvelopeChannel = {
	requestEnvelope(message: CommandEnvelope): Promise<EnvelopeReply>;
	requestEnvelopeStream(message: CommandEnvelope): AsyncIterable<EnvelopeReply>;
};

export type ResonusTransportOptions = {
	target?: string;
	deadlineMs?: number;
};

const DEFAULT_TARGET = "resonus";
const DEFAULT_DEADLINE_MS = 120_000;

// A refused call carries its reason in the payload — the runtime answers with
// `{"error":"<Reason>"}` and a generic `errorCode`. Reading only the code turns
// every server-side refusal into "application_error", which the session layer
// cannot tell a lost session from a real failure by.
function reasonFromPayload(payload: unknown): string | undefined {
	if (!payload || typeof payload !== "object") return undefined;
	const reason = (payload as { error?: unknown }).error;
	return typeof reason === "string" && reason ? reason : undefined;
}

function detail(reply: EnvelopeReply): string | undefined {
	if (typeof reply.error === "string") return reply.error;
	if (reply.error && typeof reply.error === "object" && "message" in reply.error) {
		const message = (reply.error as { message?: unknown }).message;
		if (typeof message === "string") return message;
	}
	return (
		reasonFromPayload(reply.payload) ??
		(typeof reply.errorCode === "string" ? reply.errorCode : undefined)
	);
}

function assertReply(method: string, reply: EnvelopeReply): void {
	if (reply.kind === "error") throw new Error(detail(reply) || `${method} failed`);
}

export function createResonusCommandTransport(
	channel: EnvelopeChannel,
	options: ResonusTransportOptions = {},
): ResonusCommandTransport {
	const target = options.target ?? DEFAULT_TARGET;
	const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
	const message = (
		method: string,
		payload: Record<string, unknown>,
	): CommandEnvelope => ({
		kind: "request",
		requestId: crypto.randomUUID(),
		to: { target, service: target },
		method,
		codec: "json",
		deadlineMs,
		payload,
	});

	return {
		async command(method, payload): Promise<void> {
			const reply = await channel.requestEnvelope(message(method, payload));
			assertReply(method, reply);
		},
		async *stream(method, payload): AsyncIterable<unknown> {
			for await (const reply of channel.requestEnvelopeStream(
				message(method, payload),
			)) {
				assertReply(method, reply);
				if (reply.kind !== "streamChunk") {
					throw new Error(
						`Unexpected ${method} stream reply: ${String(reply.kind)}`,
					);
				}
				yield reply.payload ?? {};
			}
		},
	};
}
