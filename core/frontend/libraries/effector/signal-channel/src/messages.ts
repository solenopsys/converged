import type { WebSocketResponseMessage } from "nrpc/browser";

export type SignalEvent = {
	type: "event" | "error" | string;
	authRequired?: boolean;
	requestId?: string;
	name?: string;
	sessionId?: string;
	payload?: unknown;
	error?: { code?: string; message?: string } | string;
	[key: string]: unknown;
};

export function isNrpcReply(
	value: SignalEvent | WebSocketResponseMessage,
): value is WebSocketResponseMessage {
	return (
		typeof value === "object" &&
		value !== null &&
		"requestId" in value &&
		typeof value.requestId === "string" &&
		"kind" in value &&
		(value.kind === "response" ||
			value.kind === "error" ||
			value.kind === "streamChunk")
	);
}


export function eventFromPayload(payload: unknown): SignalEvent | null {
	if (typeof payload !== "object" || payload === null) return null;
	const candidate = payload as SignalEvent;
	return candidate.type === "event" && typeof candidate.name === "string"
		? candidate
		: null;
}

export function errorFromEvent(event: SignalEvent): Error {
	if (typeof event.error === "string") return new Error(event.error);
	return new Error(
		event.error?.message || event.error?.code || "Signal request failed",
	);
}

/// A rejected NRPC call carries the actual reason in its payload — the runtime
/// replies with `{"error":"<Reason>"}` and a generic `errorCode`
/// ("application_error"). Reading only the code turns every server-side refusal
/// into the same meaningless string, so the payload is preferred.
export function errorFromNrpcReply(message: WebSocketResponseMessage): Error {
	const detail =
		typeof message.error === "string" ? message.error : message.error?.message;
	return new Error(
		detail ||
			reasonFromPayload(message.payload) ||
			message.errorCode ||
			"NRPC stream failed",
	);
}

function reasonFromPayload(payload: unknown): string | null {
	if (typeof payload !== "object" || payload === null) return null;
	const reason = (payload as { error?: unknown }).error;
	return typeof reason === "string" && reason.length > 0 ? reason : null;
}
