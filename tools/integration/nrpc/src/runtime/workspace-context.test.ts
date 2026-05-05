import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getCurrentRequestScope } from "back-core";
import { Elysia } from "elysia";
import type { ServiceMetadata } from "../types";
import { configureNrpcClientEnv } from "./client-env";
import { createHttpBackend } from "./http-backend";
import { createHttpClient } from "./http-client";
import { getCurrentWorkspace } from "./workspace-context";

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
			})({}),
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

	test("resolves workspace from host domain map for direct runtime requests", async () => {
		const previousMap = process.env.WORKSPACE_DOMAIN_MAP;
		process.env.WORKSPACE_DOMAIN_MAP = JSON.stringify({
			"runtime.example.com": "runtime-tenant",
		});
		try {
			const response = await fetch(
				`${baseUrl}/workspacetest/currentWorkspace`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						host: "runtime.example.com",
					},
					body: JSON.stringify({}),
				},
			);

			expect(await response.json()).toBe("runtime-tenant");
		} finally {
			if (previousMap === undefined) {
				delete process.env.WORKSPACE_DOMAIN_MAP;
			} else {
				process.env.WORKSPACE_DOMAIN_MAP = previousMap;
			}
		}
	});

	test("resolves workspace from transport forwarded host header", async () => {
		const previousMap = process.env.WORKSPACE_DOMAIN_MAP;
		const previousEnv = globalThis.__NRPC_CLIENT_ENV__;
		process.env.WORKSPACE_DOMAIN_MAP = JSON.stringify({
			"portal.example.com": "portal-tenant",
		});
		configureNrpcClientEnv({
			headers: {
				"x-forwarded-host": "portal.example.com",
			},
		});
		try {
			const client = createHttpClient<any>(metadata, { baseUrl });

			expect(await client.currentWorkspace()).toBe("portal-tenant");
		} finally {
			globalThis.__NRPC_CLIENT_ENV__ = previousEnv;
			if (previousMap === undefined) {
				delete process.env.WORKSPACE_DOMAIN_MAP;
			} else {
				process.env.WORKSPACE_DOMAIN_MAP = previousMap;
			}
		}
	});

	test("passes explicit scope into back-core request context", async () => {
		const client = createHttpClient<any>(metadata, {
			baseUrl,
			workspace: "acme",
			scope: "acme-storage",
		});

		expect(await client.currentScope()).toBe("acme-storage");
	});

	test("falls back to workspace as request storage scope", async () => {
		const client = createHttpClient<any>(metadata, {
			baseUrl,
			workspace: "acme",
		});

		expect(await client.currentScope()).toBe("acme");
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
