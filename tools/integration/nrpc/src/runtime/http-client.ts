// nrpc-runtime/http-client.ts
import type { ServiceMetadata } from "../types";
import {
	getNrpcClientBaseUrl,
	getNrpcClientHeaders,
	getNrpcClientServiceToken,
} from "./client-env";
import { deserializeValue, serializeValue } from "./serialization";
import { getRegisteredWorkspaceContext } from "./workspace-context-registry";

const NRPC_WORKSPACE_HEADER = "workspace";
const NRPC_SCOPE_HEADER = "scope";

declare global {
	var __NRPC_WORKSPACE__: string | undefined;
	var __NRPC_WORKSPACE_RESOLVER__: (() => string | undefined) | undefined;
	var __NRPC_SCOPE__: string | undefined;
	var __NRPC_SCOPE_RESOLVER__: (() => string | undefined) | undefined;
}

export interface ClientConfig {
	baseUrl?: string;
	timeout?: number;
	headers?: Record<string, string>;
	workspace?: string | (() => string | undefined);
	scope?: string | (() => string | undefined);
	workspaceHeaderName?: string;
	scopeHeaderName?: string;
}

const NRPC_HTTP_ERROR_LOGGED = Symbol("nrpc.httpErrorLogged");

export function createHttpClient<T>(
	metadata: ServiceMetadata,
	config: ClientConfig = {},
): T {
	const client = new HttpClientImpl(metadata, config);
	return createProxy(client, metadata) as T;
}

function isLikelyJwtToken(token: string): boolean {
	const parts = token.split(".");
	if (parts.length !== 3) return false;
	return parts.every((part) => part.trim().length > 0);
}

function isConnectivityIssue(error: any): boolean {
	const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
	const message =
		typeof error?.message === "string" ? error.message.toLowerCase() : "";
	const connectivityCodes = new Set([
		"connrefused",
		"econnrefused",
		"enotfound",
		"eai_again",
		"etimedout",
		"econnreset",
	]);
	return (
		connectivityCodes.has(code) ||
		message.includes("unable to connect") ||
		message.includes("connection refused") ||
		message.includes("fetch failed")
	);
}

class HttpClientImpl {
	private baseUrl?: string;
	private timeout: number;
	private headers: Record<string, string>;
	private workspace?: string | (() => string | undefined);
	private scope?: string | (() => string | undefined);
	private workspaceHeaderName: string;
	private scopeHeaderName: string;

	constructor(
		private metadata: ServiceMetadata,
		config: ClientConfig,
	) {
		this.baseUrl = config.baseUrl;
		this.timeout = config.timeout || 5000;
		this.headers = { ...config.headers };
		this.workspace = config.workspace;
		this.scope = config.scope;
		this.workspaceHeaderName =
			config.workspaceHeaderName || NRPC_WORKSPACE_HEADER;
		this.scopeHeaderName = config.scopeHeaderName || NRPC_SCOPE_HEADER;
	}

	private resolveBaseUrl(): string {
		return this.baseUrl || getNrpcClientBaseUrl() || "/services";
	}

	call(methodName: string, params: any[]): any {
		const method = this.metadata.methods.find((m) => m.name === methodName);
		if (!method) {
			throw new Error(
				`Method ${methodName} not found in service ${this.metadata.serviceName}`,
			);
		}

		if (method.isAsyncIterable) {
			return this.callStreaming(methodName, params);
		}

		return this.callRegular(methodName, params);
	}

	private resolveRequestHeaders(): Record<string, string> {
		const serviceToken = getNrpcClientServiceToken();
		const resolved: Record<string, string> = {
			...(serviceToken ? { authorization: `Bearer ${serviceToken}` } : {}),
			...this.headers,
		};
		const hasAuthorization = Object.keys(resolved).some(
			(key) => key.toLowerCase() === "authorization",
		);

		if (!hasAuthorization && typeof window !== "undefined") {
			const token = window.localStorage.getItem("authToken");
			if (token && isLikelyJwtToken(token)) {
				resolved.authorization = `Bearer ${token}`;
			}
		}

		const workspace = this.resolveWorkspace();
		if (workspace && !this.hasHeader(resolved, this.workspaceHeaderName)) {
			resolved[this.workspaceHeaderName] = workspace;
		}
		const scope = this.resolveScope(workspace);
		if (scope && !this.hasHeader(resolved, this.scopeHeaderName)) {
			resolved[this.scopeHeaderName] = scope;
		}
		for (const [key, value] of Object.entries(getNrpcClientHeaders())) {
			if (!this.hasHeader(resolved, key)) {
				resolved[key] = value;
			}
		}

		return resolved;
	}

	private resolveWorkspace(): string | undefined {
		const explicit =
			typeof this.workspace === "function" ? this.workspace() : this.workspace;
		const runtimeWorkspace =
			getRegisteredWorkspaceContext()?.workspace ??
			(typeof globalThis !== "undefined"
				? globalThis.__NRPC_WORKSPACE_RESOLVER__?.()
				: undefined);
		const globalWorkspace =
			typeof globalThis !== "undefined"
				? globalThis.__NRPC_WORKSPACE__
				: undefined;
		const workspace = explicit || runtimeWorkspace || globalWorkspace;
		const normalized = workspace?.trim();
		return normalized || undefined;
	}

	private resolveScope(workspace?: string): string | undefined {
		const explicit =
			typeof this.scope === "function" ? this.scope() : this.scope;
		const contextScope = getRegisteredWorkspaceContext()?.scope;
		const runtimeScope =
			typeof globalThis !== "undefined"
				? globalThis.__NRPC_SCOPE_RESOLVER__?.()
				: undefined;
		const globalScope =
			typeof globalThis !== "undefined" ? globalThis.__NRPC_SCOPE__ : undefined;
		const scope =
			explicit || contextScope || runtimeScope || globalScope || workspace;
		const normalized = scope?.trim();
		return normalized || undefined;
	}

	private hasHeader(headers: Record<string, string>, name: string): boolean {
		return Object.keys(headers).some(
			(key) => key.toLowerCase() === name.toLowerCase(),
		);
	}

	// A 401 means the token the browser sent was rejected (invalid signature /
	// expired / issued for another site). Drop it and let the app fall back to an
	// unauthenticated state — effector listens to "auth-token-changed". We only
	// touch the browser-stored token: service tokens and caller-supplied
	// authorization headers are left alone.
	private handleUnauthorized(requestHeaders: Record<string, string>): void {
		if (typeof window === "undefined") return;
		if (getNrpcClientServiceToken()) return;

		const stored = window.localStorage.getItem("authToken");
		if (!stored) return;

		const sent = requestHeaders.authorization ?? requestHeaders.Authorization;
		if (sent !== `Bearer ${stored}`) return;

		window.localStorage.removeItem("authToken");
		window.dispatchEvent(new Event("auth-token-changed"));
	}

	private async callRegular(methodName: string, params: any[]): Promise<any> {
		const method = this.metadata.methods.find((m) => m.name === methodName);
		const path = `/${this.metadata.serviceName}/${methodName}`;
		const body = this.prepareParams(method!.parameters, params);

		// Локальный AbortController для каждого запроса
		const abortController = new AbortController();

		const timeoutId = setTimeout(() => {
			abortController.abort();
		}, this.timeout);

		try {
			const url = `${this.resolveBaseUrl()}${path}`;
			const requestHeaders = this.resolveRequestHeaders();
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...requestHeaders,
				},
				body: JSON.stringify(body),
				signal: abortController.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				if (response.status === 401) {
					this.handleUnauthorized(requestHeaders);
				}

				let errorMessage = `HTTP ${url} ${response.status}: ${response.statusText}`;
				let errorCode: string | undefined;
				let errorDetails: Record<string, unknown> | undefined;

				try {
					const errorData = await response.json();
					if (errorData.error) {
						errorMessage = errorData.error;
					}
					if (typeof errorData.code === "string") {
						errorCode = errorData.code;
					}
					if (errorData.details && typeof errorData.details === "object") {
						errorDetails = errorData.details;
					}
				} catch {
					// ignore
				}

				console.error(`[nrpc] ✗ ${url}:`, errorMessage);
				const error = new Error(errorMessage) as Error & {
					statusCode?: number;
					code?: string;
					details?: Record<string, unknown>;
				};
				error.statusCode = response.status;
				if (errorCode) error.code = errorCode;
				if (errorDetails) error.details = errorDetails;
				Object.defineProperty(error, NRPC_HTTP_ERROR_LOGGED, { value: true });
				throw error;
			}

			if (method!.returnType === "void") {
				return undefined;
			}

			const contentType = response.headers.get("content-type");
			if (contentType?.includes("application/json")) {
				const data = await response.json();
				return deserializeValue(data, method!.returnType);
			} else {
				return response.text();
			}
		} catch (error: any) {
			clearTimeout(timeoutId);

			if (error.name === "AbortError") {
				throw new Error(`Request timeout after ${this.timeout}ms`);
			}

			if (error?.[NRPC_HTTP_ERROR_LOGGED]) {
				throw error;
			}

			if (isConnectivityIssue(error)) {
				console.info(
					`[nrpc] · ${this.resolveBaseUrl()}${path}:`,
					error.message,
				);
			} else {
				console.error(
					`[nrpc] ✗ ${this.resolveBaseUrl()}${path}:`,
					error.message,
				);
			}
			throw error;
		}
	}

	private callStreaming(methodName: string, params: any[]): AsyncIterable<any> {
		const method = this.metadata.methods.find((m) => m.name === methodName);
		const path = `/${this.metadata.serviceName}/${methodName}/stream`;
		const body = this.prepareParams(method!.parameters, params);
		const self = this;

		return {
			async *[Symbol.asyncIterator]() {
				// Локальный AbortController для стрима
				const abortController = new AbortController();

				const requestHeaders = self.resolveRequestHeaders();
				const response = await fetch(`${self.resolveBaseUrl()}${path}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "text/event-stream",
						...requestHeaders,
					},
					body: JSON.stringify(body),
					signal: abortController.signal,
				});

				if (!response.ok) {
					let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
					try {
						const errorData = await response.json();
						if (errorData.error) {
							errorMessage = errorData.error;
						}
					} catch {
						// ignore
					}
					throw new Error(errorMessage);
				}

				if (!response.body) {
					throw new Error("Response body is null");
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				try {
					let buffer = "";

					while (true) {
						const { done, value } = await reader.read();

						if (done) break;

						buffer += decoder.decode(value, { stream: true });

						let eventStart = 0;
						let eventEnd = buffer.indexOf("\n\n");

						while (eventEnd !== -1) {
							const eventData = buffer.slice(eventStart, eventEnd);

							const lines = eventData.split("\n");
							for (const line of lines) {
								const trimmed = line.trim();
								if (!trimmed) continue;

								if (trimmed.startsWith("data: ")) {
									const data = trimmed.slice(6);

									if (data === "[DONE]") {
										return;
									}

									try {
										const parsed = JSON.parse(data);
										const deserialized = deserializeValue(
											parsed,
											method!.returnType,
										);
										yield deserialized;
									} catch (error) {
										console.error("Error parsing JSON data:", data, error);
									}
								}
							}

							eventStart = eventEnd + 2;
							eventEnd = buffer.indexOf("\n\n", eventStart);
						}

						buffer = buffer.slice(eventStart);
					}
				} finally {
					reader.releaseLock();
				}
			},
		};
	}

	private prepareParams(paramDefs: any[], params: any[]): Record<string, any> {
		const result: Record<string, any> = {};

		paramDefs.forEach((def, index) => {
			if (params[index] !== undefined) {
				result[def.name] = serializeValue(params[index], def.type);
			} else if (!def.optional) {
				throw new Error(`Required parameter '${def.name}' is missing`);
			}
		});

		return result;
	}
}

function createProxy(client: HttpClientImpl, metadata: ServiceMetadata): any {
	const proxy: Record<string, any> = {};

	metadata.methods.forEach((method) => {
		proxy[method.name] = (...args: any[]) => {
			const requiredParamsCount = method.parameters.filter(
				(p) => !p.optional,
			).length;
			const totalParamsCount = method.parameters.length;

			if (args.length < requiredParamsCount) {
				throw new Error(
					`Method ${method.name} requires at least ${requiredParamsCount} arguments, got ${args.length}`,
				);
			}

			if (args.length > totalParamsCount) {
				throw new Error(
					`Method ${method.name} accepts at most ${totalParamsCount} arguments, got ${args.length}`,
				);
			}

			return client.call(method.name, args);
		};
	});

	proxy._metadata = metadata;

	return proxy;
}
