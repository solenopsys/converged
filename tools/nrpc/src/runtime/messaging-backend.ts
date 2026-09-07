import type { IncomingMessage } from "bun-transport/messaging";
import { resolveMethodAccess, resolveServiceName } from "../decorator/access.decorator";
import type { ServiceMetadata } from "../types";
import { MessagingAccessGuard, type MessagingAccessConfig } from "./messaging-access";
import { deserializeValue, serializeValue } from "./serialization";
import { runWithWorkspaceContext } from "./workspace-context";
import type { WorkspaceContext } from "./workspace-context-registry";
import type {
	MessagingDispatchResult,
	MessagingServiceHandler,
	NrpcMessagingRuntime,
} from "./messaging-runtime";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface MessagingBackendConfig {
	runtime: NrpcMessagingRuntime;
	metadata: ServiceMetadata;
	serviceImpl: any;
	serviceOptions?: Record<string, unknown>;
	runWithContext?: <T>(context: WorkspaceContext, callback: () => T) => T;
	registerStartupTask?: (name: string, task: () => Promise<void>) => void;
	registerShutdownTask?: (name: string, task: () => Promise<void>) => void;
	access?: MessagingAccessConfig;
}

export function createMessagingBackend(config: MessagingBackendConfig): MessagingBackend {
	return new MessagingBackend(config);
}

export class MessagingBackend implements MessagingServiceHandler {
	readonly descriptor: MessagingServiceHandler["descriptor"];
	private serviceInstance: any;
	private serviceReady?: Promise<void>;
	private shutdownPromise?: Promise<void>;
	private readonly access: MessagingAccessGuard;

	constructor(private readonly config: MessagingBackendConfig) {
		const implementation = typeof config.serviceImpl === "function"
			? config.serviceImpl.prototype
			: config.serviceImpl;
		const serviceName = resolveServiceName(implementation) ?? config.metadata.serviceName;
		this.descriptor = {
			name: serviceName,
			methods: config.metadata.methods.map((method) => ({
				name: method.name,
				access: resolveMethodAccess(implementation, method.name),
			})),
		};
		this.access = new MessagingAccessGuard(config.access);
		config.runtime.registerService(this);
		config.registerStartupTask?.(`nrpc:${serviceName}`, () => this.waitUntilReady());
		config.registerShutdownTask?.(`nrpc:${serviceName}`, () => this.shutdown());
	}

	waitUntilReady(): Promise<void> {
		if (!this.serviceReady) this.serviceReady = this.initializeService();
		return this.serviceReady;
	}

	async shutdown(): Promise<void> {
		if (!this.shutdownPromise) this.shutdownPromise = this.doShutdown();
		await this.shutdownPromise;
	}

	async dispatch(message: IncomingMessage): Promise<MessagingDispatchResult> {
		await this.waitUntilReady();
		const method = this.config.metadata.methods.find((candidate) => candidate.name === message.envelope.method);
		if (!method) throw withCode(new Error(`method not found: ${message.envelope.method}`), "method_unavailable");
		if (typeof this.serviceInstance?.[method.name] !== "function") {
			throw withCode(new Error(`method is not implemented: ${method.name}`), "method_unavailable");
		}

		const trusted = await this.access.authorize({
			token: message.envelope.auth,
			envelopeScope: message.envelope.scope,
			serviceName: this.descriptor.name,
			methodName: method.name,
			access: resolveMethodAccess(
				this.serviceInstance,
				method.name,
			),
		});
		const params = message.payload.byteLength === 0
			? {}
			: JSON.parse(decoder.decode(message.payload));
		const args = buildMethodArgs(method, params);
		const context: WorkspaceContext = {
			workspace: (trusted?.scope ?? message.envelope.scope) || undefined,
			scope: (trusted?.scope ?? message.envelope.scope) || undefined,
			user: (trusted?.user ?? message.envelope.user) || undefined,
			auth: (trusted?.auth ?? message.envelope.auth) || undefined,
		};
		const invoke = async () => {
			await this.ensureStoresForContext();
			return this.serviceInstance[method.name](...args);
		};

		if (method.isAsyncIterable) {
			const iterable = await this.runWithContext(context, invoke);
			if (!iterable || typeof iterable[Symbol.asyncIterator] !== "function") {
				throw new Error(`method ${method.name} did not return an AsyncIterable`);
			}
			return { stream: this.serializeStream(iterable, method.returnType, context) };
		}

		const result = await this.runWithContext(context, invoke);
		return { payload: encoder.encode(JSON.stringify(serializeValue(result, method.returnType) ?? null)) };
	}

	private async initializeService(): Promise<void> {
		if (typeof this.config.serviceImpl === "object" && this.config.serviceImpl !== null) {
			this.serviceInstance = this.config.serviceImpl;
		} else if (typeof this.config.serviceImpl === "function") {
			this.serviceInstance = new this.config.serviceImpl(this.config.serviceOptions ?? {});
		} else {
			throw new Error(`invalid service implementation for ${this.descriptor.name}`);
		}
		const initPromise = this.serviceInstance?.initPromise;
		if (initPromise && typeof initPromise.then === "function") await initPromise;
	}

	private async doShutdown(): Promise<void> {
		if (this.serviceReady) {
			try {
				await this.serviceReady;
			} catch {
				return;
			}
		}
		const service = this.serviceInstance;
		if (!service) return;
		if (typeof service.destroy === "function") {
			await service.destroy();
			return;
		}
		if (typeof service.stores?.destroy === "function") {
			await service.stores.destroy();
			return;
		}
		if (typeof service.stores?.closeAll === "function") await service.stores.closeAll();
	}

	private async *serializeStream(
		iterable: AsyncIterable<unknown>,
		returnType: string,
		context: WorkspaceContext,
	): AsyncIterable<Uint8Array> {
		const iterator = iterable[Symbol.asyncIterator]();
		while (true) {
			const next = await this.runWithContext(context, () => iterator.next());
			if (next.done) return;
			yield encoder.encode(JSON.stringify(serializeValue(next.value, returnType) ?? null));
		}
	}

	private runWithContext<T>(context: WorkspaceContext, callback: () => T): T {
		return runWithWorkspaceContext(context, () =>
			this.config.runWithContext ? this.config.runWithContext(context, callback) : callback(),
		);
	}

	private async ensureStoresForContext(): Promise<void> {
		const stores = this.serviceInstance?.stores;
		if (typeof stores?.ensureCurrentScopeReady === "function") await stores.ensureCurrentScopeReady();
	}
}

function buildMethodArgs(
	method: ServiceMetadata["methods"][number],
	params: Record<string, unknown>,
): unknown[] {
	const singleParameter = method.parameters.length === 1;
	return method.parameters.map((parameter) => {
		let raw = params?.[parameter.name];
		if (
			raw === undefined &&
			singleParameter &&
			params &&
			typeof params === "object" &&
			!Array.isArray(params) &&
			Object.keys(params).length > 0
		) {
			raw = params;
		}
		return deserializeValue(raw, parameter.type);
	});
}

function withCode(error: Error, code: string): Error {
	(error as Error & { code?: string }).code = code;
	return error;
}
