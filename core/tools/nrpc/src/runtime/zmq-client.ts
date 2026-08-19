import type { ServiceMetadata } from "../types";
import { getNrpcClientServiceToken } from "./client-env";
import { deserializeValue, serializeValue } from "./serialization";
import { getRegisteredWorkspaceContext } from "./workspace-context-registry";
import type { NrpcMessagingRuntime } from "./messaging-runtime";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface ZmqClientConfig {
	runtime: NrpcMessagingRuntime;
	target: string;
	deadlineMs: number;
	scope?: string | (() => string | undefined);
	user?: string | (() => string | undefined);
	auth?: string | (() => string | undefined);
}

export function createZmqClient<T>(metadata: ServiceMetadata, config: ZmqClientConfig): T {
	const client = new ZmqClientImpl(metadata, config);
	return createProxy(client, metadata) as T;
}

class ZmqClientImpl {
	constructor(
		private readonly metadata: ServiceMetadata,
		private readonly config: ZmqClientConfig,
	) {
		if (!config.target.trim()) throw new Error("nrpc ZMQ client target is empty");
		if (!Number.isSafeInteger(config.deadlineMs) || config.deadlineMs <= 0) {
			throw new Error("nrpc ZMQ client deadlineMs must be a positive integer");
		}
	}

	call(methodName: string, params: unknown[]): Promise<unknown> | AsyncIterable<unknown> {
		const method = this.metadata.methods.find((candidate) => candidate.name === methodName);
		if (!method) throw new Error(`Method ${methodName} not found in service ${this.metadata.serviceName}`);
		const payload = encoder.encode(JSON.stringify(this.prepareParams(method.parameters, params)));
		const request = {
			target: this.config.target,
			service: this.metadata.serviceName,
			method: methodName,
			scope: this.resolve(this.config.scope) ?? getRegisteredWorkspaceContext()?.scope,
			user: this.resolve(this.config.user) ?? getRegisteredWorkspaceContext()?.user,
			// A request acting on behalf of a browser keeps its user JWT. Server-side
			// calls without one use the narrowly-permitted service JWT instead.
			auth: this.resolve(this.config.auth) ?? getRegisteredWorkspaceContext()?.auth ?? getNrpcClientServiceToken(),
			deadlineMs: this.config.deadlineMs,
			payload,
		};

		if (method.isAsyncIterable) {
			const chunks = this.config.runtime.requestStream(request);
			return {
				async *[Symbol.asyncIterator]() {
					for await (const chunk of chunks) {
						const value = JSON.parse(decoder.decode(chunk));
						yield deserializeValue(value, method.returnType);
					}
				},
			};
		}

		return this.config.runtime.request(request).then((response) => {
			if (method.returnType === "void") return undefined;
			return deserializeValue(JSON.parse(decoder.decode(response)), method.returnType);
		});
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

	private resolve(value: string | (() => string | undefined) | undefined): string | undefined {
		const resolved = typeof value === "function" ? value() : value;
		const normalized = resolved?.trim();
		return normalized || undefined;
	}
}

function createProxy(client: ZmqClientImpl, metadata: ServiceMetadata): object {
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

function assertArguments(method: ServiceMetadata["methods"][number], args: unknown[]): void {
	const required = method.parameters.filter((parameter) => !parameter.optional).length;
	if (args.length < required) {
		throw new Error(`Method ${method.name} requires at least ${required} arguments, got ${args.length}`);
	}
	if (args.length > method.parameters.length) {
		throw new Error(`Method ${method.name} accepts at most ${method.parameters.length} arguments, got ${args.length}`);
	}
}
