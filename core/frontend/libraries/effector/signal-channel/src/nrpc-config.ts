import type { WebSocketClientConfig } from "nrpc/browser";
import { signalChannel } from "./singleton";

export type FrontNrpcClientOptions = {
	target?: string;
	scope?: string;
	deadlineMs?: number;
};

declare global {
	var __FUJIN_BACKEND_TARGET__: string | undefined;
	var __FUJIN_NRPC_DEADLINE_MS__: number | undefined;
}

const DEFAULT_BACKEND_TARGET = "services";
const DEFAULT_DEADLINE_MS = 20_000;

const nrpcChannel = {
	request: (message: Parameters<typeof signalChannel.requestEnvelope>[0]) =>
		signalChannel.requestEnvelope(message),
	requestStream: (
		message: Parameters<typeof signalChannel.requestEnvelopeStream>[0],
	) => signalChannel.requestEnvelopeStream(message),
};

export function createFrontNrpcClientConfig(
	options: FrontNrpcClientOptions = {},
): WebSocketClientConfig {
	const target = (
		options.target ??
		globalThis.__FUJIN_BACKEND_TARGET__ ??
		DEFAULT_BACKEND_TARGET
	).trim();
	if (!target) throw new Error("Fujin browser target is empty");

	const deadlineMs =
		options.deadlineMs ??
		globalThis.__FUJIN_NRPC_DEADLINE_MS__ ??
		DEFAULT_DEADLINE_MS;
	if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0) {
		throw new Error("Fujin browser deadlineMs must be a positive integer");
	}

	return {
		channel: nrpcChannel,
		target,
		deadlineMs,
	};
}
