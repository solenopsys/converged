import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	getCurrentRequestScope,
	runWithRequestScopeContext,
} from "back-core/request-context";
import { Elysia } from "elysia";
import type { ServiceMetadata } from "../types";
import { createHttpBackend } from "./http-backend";
import { createHttpClient } from "./http-client";
import { getCurrentWorkspace } from "./workspace-context";
import type { WorkspaceContext } from "./workspace-context-registry";

class WorkspaceTestService {
	currentWorkspace(): string | null {
		return getCurrentWorkspace() ?? null;
	}

	currentScope(): string | null {
		return getCurrentRequestScope() ?? null;
	}
}

const metadata: ServiceMetadata = {
	serviceName: "workspacetest",
	interfaceName: "WorkspaceTestService",
	filePath: "test",
	methods: [
		{
			name: "currentWorkspace",
			parameters: [],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "currentScope",
			parameters: [],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
	],
	types: [],
};

function runBackCoreContext<T>(
	context: WorkspaceContext,
	callback: () => T,
): T {
	return runWithRequestScopeContext(
		{
			workspace: context.workspace,
			scope: context.scope ?? context.workspace,
			headers: context.headers,
		},
		callback,
	);
}

describe("Workspace context", () => {
	let app: Elysia;
	let previousFetch: typeof fetch;
	let baseUrl: string;

	beforeAll(async () => {
		app = new Elysia();
		app.use(
			createHttpBackend({
				metadata,
				serviceImpl: WorkspaceTestService,
				pathPrefix: "/services",
			})({
				runWithContext: runBackCoreContext,
			}),
		);
		baseUrl = "http://nrpc.test/services";
		previousFetch = globalThis.fetch;
		globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
			const request =
				input instanceof Request ? input : new Request(input, init);
			if (new URL(request.url).host === "nrpc.test") {
				return app.handle(request);
			}
			return previousFetch(input, init);
		}) as typeof fetch;
	});

	afterAll(() => {
		globalThis.fetch = previousFetch;
	});

	test("passes workspace header into local service context", async () => {
		const client = createHttpClient<any>(metadata, {
			baseUrl,
			workspace: "acme",
		});

		expect(await client.currentWorkspace()).toBe("acme");
	});

	test("passes explicit scope into external request context", async () => {
		const client = createHttpClient<any>(metadata, {
			baseUrl,
			workspace: "acme",
			scope: "acme-data",
		});

		expect(await client.currentScope()).toBe("acme-data");
	});

	test("falls back to workspace as generic request scope", async () => {
		const client = createHttpClient<any>(metadata, {
			baseUrl,
			workspace: "acme",
		});

		expect(await client.currentScope()).toBe("acme");
	});

	test("reads direct workspace and scope headers", async () => {
		const response = await fetch(`${baseUrl}/workspacetest/currentScope`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				workspace: "direct",
				"x-scope": "direct-scope",
			},
			body: JSON.stringify({}),
		});

		expect(await response.json()).toBe("direct-scope");
	});

	test("does not resolve workspace from host inside nrpc transport", async () => {
		const response = await fetch(`${baseUrl}/workspacetest/currentWorkspace`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				host: "runtime.example.com",
			},
			body: JSON.stringify({}),
		});

		expect(await response.json()).toBeNull();
	});

	test("keeps workspace optional for existing clients", async () => {
		const client = createHttpClient<any>(metadata, { baseUrl });

		expect(await client.currentWorkspace()).toBeNull();
	});

	test("uses browser bootstrap workspace when client config omits it", async () => {
		const previousWorkspace = globalThis.__NRPC_WORKSPACE__;
		globalThis.__NRPC_WORKSPACE__ = "browser-tenant";
		try {
			const client = createHttpClient<any>(metadata, { baseUrl });

			expect(await client.currentWorkspace()).toBe("browser-tenant");
		} finally {
			globalThis.__NRPC_WORKSPACE__ = previousWorkspace;
		}
	});

	test("uses request scoped workspace resolver before browser global", async () => {
		const previousResolver = globalThis.__NRPC_WORKSPACE_RESOLVER__;
		const previousWorkspace = globalThis.__NRPC_WORKSPACE__;
		globalThis.__NRPC_WORKSPACE__ = "browser-tenant";
		globalThis.__NRPC_WORKSPACE_RESOLVER__ = () => "ssr-tenant";
		try {
			const client = createHttpClient<any>(metadata, { baseUrl });

			expect(await client.currentWorkspace()).toBe("ssr-tenant");
		} finally {
			globalThis.__NRPC_WORKSPACE_RESOLVER__ = previousResolver;
			globalThis.__NRPC_WORKSPACE__ = previousWorkspace;
		}
	});
});
