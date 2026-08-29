import type { ServiceMetadata } from "../types";
import { deserializeValue, serializeValue } from "./serialization";

export type WebSocketMessageKind =
	| "request"
	| "response"
	| "error"
	| "event"
	| "streamChunk";

export interface WebSocketRequestMessage {
	kind: "request";
	requestId: string;
	to: { target: string; service: string };
	method: string;
	codec: "json";
	deadlineMs: number;
	payload: unknown;
}

export interface WebSocketResponseMessage {
	kind: Exclude<WebSocketMessageKind, "request">;
	requestId: string;
	payload?: unknown;
	seq?: number;
	fin?: boolean;
	errorCode?: string;
	error?: string | { code?: string; message?: string; details?: unknown };
}

export interface WebSocketChannelController {
	request(message: WebSocketRequestMessage): Promise<WebSocketResponseMessage>;
	requestStream(
		message: WebSocketRequestMessage,
	): AsyncIterable<WebSocketResponseMessage>;
}

export interface MessagingClientConfig {
	channel: WebSocketChannelController;
	target: string;
	deadlineMs: number;
}

export type WebSocketClientConfig = MessagingClientConfig;

export function createMessagingClient<T>(
	metadata: ServiceMetadata,
	config: MessagingClientConfig,
): T {
	const client = new MessagingClientImpl(metadata, config);
	return createProxy(client, metadata) as T;
}

export const createWebSocketClient = createMessagingClient;

class MessagingClientImpl {
	constructor(
		private readonly metadata: ServiceMetadata,
		private readonly config: MessagingClientConfig,
	) {
		if (!config.target.trim())
			throw new Error("nrpc WebSocket client target is empty");
		if (!Number.isSafeInteger(config.deadlineMs) || config.deadlineMs <= 0) {
			throw new Error(
				"nrpc WebSocket client deadlineMs must be a positive integer",
			);
		}
	}

	call(
		methodName: string,
		params: unknown[],
	): Promise<unknown> | AsyncIterable<unknown> {
		const method = this.metadata.methods.find(
			(candidate) => candidate.name === methodName,
		);
		if (!method)
			throw new Error(
				`Method ${methodName} not found in service ${this.metadata.serviceName}`,
			);
		const request = this.createRequest(
			methodName,
			this.prepareParams(method.parameters, params),
		);

		if (method.isAsyncIterable) {
			const messages = this.config.channel.requestStream(request);
			return {
				async *[Symbol.asyncIterator]() {
					let expectedSeq = 1;
					for await (const message of messages) {
						assertMatchingReply(request, message);
						if (message.kind === "error") throw errorFromReply(message);
						if (message.kind !== "streamChunk") {
							throw new Error(
								`nrpc WebSocket stream received unexpected ${message.kind}`,
							);
						}
						if (message.seq !== expectedSeq) {
							throw new Error(
								`nrpc WebSocket stream expected seq ${expectedSeq}, got ${message.seq ?? "none"}`,
							);
						}
						expectedSeq++;
						if (message.payload !== undefined) {
							yield deserializeValue(message.payload, method.returnType);
						}
						if (message.fin) return;
					}
				},
			};
		}

		return this.config.channel.request(request).then((message) => {
			assertMatchingReply(request, message);
			if (message.kind === "error") throw errorFromReply(message);
			if (message.kind !== "response") {
				throw new Error(
					`nrpc WebSocket request received unexpected ${message.kind}`,
				);
			}
			if (method.returnType === "void") return undefined;
			return deserializeValue(message.payload, method.returnType);
		});
	}

	private createRequest(
		method: string,
		payload: unknown,
	): WebSocketRequestMessage {
		return {
			kind: "request",
			requestId: crypto.randomUUID(),
			to: { target: this.config.target, service: this.metadata.serviceName },
			method,
			codec: "json",
			deadlineMs: this.config.deadlineMs,
			payload,
		};
	}

	private prepareParams(
		parameters: ServiceMetadata["methods"][number]["parameters"],
		params: unknown[],
	): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		parameters.forEach((parameter, index) => {
			if (params[index] !== undefined) {
				result[parameter.name] = serializeValue(params[index], parameter.type);
			} else if (!parameter.optional) {
				throw new Error(`Required parameter '${parameter.name}' is missing`);
			}
		});
		return result;
	}
}

function createProxy(
	client: MessagingClientImpl,
	metadata: ServiceMetadata,
): object {
	const proxy: Record<string, unknown> = {};
	for (const method of metadata.methods) {
		proxy[method.name] = (...args: unknown[]) => {
			assertArguments(method, args);
			return client.call(method.name, args);
		};
	}
	proxy._metadata = metadata;
	return proxy;
}

function assertMatchingReply(
	request: WebSocketRequestMessage,
	reply: WebSocketResponseMessage,
): void {
	if (reply.requestId !== request.requestId) {
		throw new Error(
			`nrpc WebSocket response requestId mismatch: ${reply.requestId}`,
		);
	}
}

function errorFromReply(message: WebSocketResponseMessage): Error {
	const body =
		typeof message.error === "string"
			? { message: message.error }
			: message.error;
	const payloadReason = errorReasonFromPayload(message.payload);
	const error = new Error(
		body?.message ||
			body?.code ||
			payloadReason ||
			message.errorCode ||
			"remote nrpc error",
	) as Error & {
		code?: string;
		details?: unknown;
	};
	error.code = body?.code || message.errorCode;
	error.details = body?.details;
	return error;
}

function errorReasonFromPayload(payload: unknown): string | undefined {
	if (typeof payload !== "object" || payload === null) return undefined;
	const reason = (payload as { error?: unknown }).error;
	return typeof reason === "string" && reason.length > 0 ? reason : undefined;
}

function assertArguments(
	method: ServiceMetadata["methods"][number],
	args: unknown[],
): void {
	const required = method.parameters.filter(
		(parameter) => !parameter.optional,
	).length;
	if (args.length < required) {
		throw new Error(
			`Method ${method.name} requires at least ${required} arguments, got ${args.length}`,
		);
	}
	if (args.length > method.parameters.length) {
		throw new Error(
			`Method ${method.name} accepts at most ${method.parameters.length} arguments, got ${args.length}`,
		);
	}
}
