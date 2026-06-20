import { describe, expect, test } from "bun:test";
import {
	getCurrentStorageScope,
	resolveRequestScopeFromHeaders,
	runWithRequestScopeContext,
} from "./request-context";
import {
	StoreControllerAbstract,
	resolveStorageConnectionTargetForScope,
} from "./stores/create";
import { StoreType } from "./stores/types";

class TestStoresController extends StoreControllerAbstract {
	async init(): Promise<void> {
		await this.addStore("items", StoreType.FILES, []);
	}

	async destroy(): Promise<void> {}
}

function withEnv<T>(
	values: Record<string, string | undefined>,
	callback: () => T,
): T {
	const previous = new Map<string, string | undefined>();
	for (const [key, value] of Object.entries(values)) {
		previous.set(key, process.env[key]);
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	const restore = () => {
		for (const [key, value] of previous) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	};

	try {
		const result = callback();
		if (result && typeof (result as Promise<T>).finally === "function") {
			return (result as Promise<T>).finally(restore) as T;
		}
		restore();
		return result;
	} catch (error) {
		restore();
		throw error;
	}
}

describe("request scope context", () => {
	test("prefers explicit storage scope headers", () => {
		expect(
			resolveRequestScopeFromHeaders(
				{
					workspace: "workspace-a",
					"x-storage-scope": "storage-a",
				},
				"workspace-a",
			),
		).toBe("storage-a");
	});

	test("falls back to workspace as storage scope", () => {
		expect(resolveRequestScopeFromHeaders({}, "workspace-a")).toBe(
			"workspace-a",
		);
	});

	test("resolves storage scope from request host domain map", () => {
		const previous = process.env.WORKSPACE_DOMAIN_MAP;
		process.env.WORKSPACE_DOMAIN_MAP = JSON.stringify({
			"democnc.4ir.club": "democnc",
		});

		try {
			expect(
				resolveRequestScopeFromHeaders({
					"x-forwarded-host": "democnc.4ir.club",
				}),
			).toBe("democnc");
		} finally {
			if (previous === undefined) {
				delete process.env.WORKSPACE_DOMAIN_MAP;
			} else {
				process.env.WORKSPACE_DOMAIN_MAP = previous;
			}
		}
	});

	test("keeps request scoped value in async local storage", async () => {
		await runWithRequestScopeContext({ scope: "tenant-a" }, async () => {
			await Promise.resolve();
			expect(getCurrentStorageScope()).toBe("tenant-a");
		});
	});

	test("uses request headers as storage scope fallback", async () => {
		const previous = process.env.WORKSPACE_DOMAIN_MAP;
		process.env.WORKSPACE_DOMAIN_MAP = JSON.stringify({
			"democnc.4ir.club": "democnc",
		});

		try {
			await runWithRequestScopeContext(
				{ headers: { host: "democnc.4ir.club" } },
				async () => {
					await Promise.resolve();
					expect(getCurrentStorageScope()).toBe("democnc");
				},
			);
		} finally {
			if (previous === undefined) {
				delete process.env.WORKSPACE_DOMAIN_MAP;
			} else {
				process.env.WORKSPACE_DOMAIN_MAP = previous;
			}
		}
	});

	test("shares request scope across duplicated module instances", async () => {
		const duplicate = (await import(
			`./request-context.ts?copy=${Date.now()}`
		)) as typeof import("./request-context");

		await runWithRequestScopeContext({ scope: "tenant-a" }, async () => {
			await Promise.resolve();
			expect(duplicate.getCurrentStorageScope()).toBe("tenant-a");
		});
	});

	test("resolves storage endpoint from tenant services by scope", () => {
		withEnv(
			{
				STORAGE_TRANSPORT: "tcp",
				STORAGE_PORT: "9000",
				STORAGE_SERVICE_PREFIX: undefined,
				STORAGE_HOST: undefined,
				STORAGE_SCOPE: undefined,
				STORAGE_TENANT: undefined,
				STORAGE_TENANT_SERVICES: JSON.stringify({
					default: { host: "storage-default", port: 9000 },
					"tenant-a": { host: "storage-a", port: 9001 },
					"tenant-b": "tcp:storage-b:9002",
				}),
			},
			() => {
				expect(resolveStorageConnectionTargetForScope("tenant-a")).toEqual({
					kind: "tcp",
					host: "storage-a",
					port: 9001,
				});
				expect(resolveStorageConnectionTargetForScope("tenant-b")).toEqual({
					kind: "tcp",
					host: "storage-b",
					port: 9002,
				});
			},
		);
	});

	test("registers stores without connecting to default storage outside request scope", async () => {
		await withEnv(
			{
				STORAGE_TRANSPORT: "tcp",
				STORAGE_PORT: "9000",
				STORAGE_SERVICE_PREFIX: "converged-storage",
				NRPC_WORKSPACE: "default",
				STORAGE_HOST: undefined,
				STORAGE_SCOPE: undefined,
				STORAGE_TENANT: undefined,
				STORAGE_TENANT_SERVICES: undefined,
			},
			async () => {
				const stores = new TestStoresController("test-ms");
				await expect(stores.init()).resolves.toBeUndefined();
			},
		);
	});

	test("fails storage operations without scope in cloud storage mode", async () => {
		await withEnv(
			{
				STORAGE_TRANSPORT: "tcp",
				STORAGE_PORT: "9000",
				STORAGE_SERVICE_PREFIX: "converged-storage",
				NRPC_WORKSPACE: "default",
				STORAGE_HOST: undefined,
				STORAGE_SCOPE: undefined,
				STORAGE_TENANT: undefined,
				STORAGE_TENANT_SERVICES: undefined,
			},
			async () => {
				const stores = new TestStoresController("test-ms");
				await stores.init();
				await expect(stores.startAll()).resolves.toBeUndefined();
				await expect(stores.getStoreSize("items")).rejects.toThrow(
					/Storage scope is required/,
				);
				expect(() => resolveStorageConnectionTargetForScope()).toThrow(
					/Storage scope is required/,
				);
			},
		);
	});

	test("resolves cloud storage target only from explicit scope", () => {
		withEnv(
			{
				STORAGE_TRANSPORT: "tcp",
				STORAGE_PORT: "9000",
				STORAGE_SERVICE_PREFIX: "converged-storage",
				STORAGE_HOST: undefined,
				STORAGE_SCOPE: undefined,
				STORAGE_TENANT: undefined,
				STORAGE_TENANT_SERVICES: undefined,
			},
			() => {
				expect(resolveStorageConnectionTargetForScope("democnc")).toEqual({
					kind: "tcp",
					host: "converged-storage-democnc",
					port: 9000,
				});
			},
		);
	});

	test("does not use tenant default endpoint in cloud storage mode", () => {
		withEnv(
			{
				STORAGE_TRANSPORT: "tcp",
				STORAGE_PORT: "9000",
				STORAGE_SERVICE_PREFIX: "converged-storage",
				STORAGE_TENANT_SERVICES: JSON.stringify({
					default: { host: "storage-default", port: 9000 },
				}),
				STORAGE_HOST: undefined,
				STORAGE_SCOPE: undefined,
				STORAGE_TENANT: undefined,
			},
			() => {
				expect(() => resolveStorageConnectionTargetForScope()).toThrow(
					/Storage scope is required/,
				);
				expect(resolveStorageConnectionTargetForScope("democnc")).toEqual({
					kind: "tcp",
					host: "converged-storage-democnc",
					port: 9000,
				});
			},
		);
	});

	test("allows fixed storage host without request scope", async () => {
		await withEnv(
			{
				STORAGE_TRANSPORT: "tcp",
				STORAGE_PORT: "9000",
				STORAGE_SERVICE_PREFIX: undefined,
				STORAGE_HOST: "fixed-storage",
				STORAGE_SCOPE: undefined,
				STORAGE_TENANT: undefined,
				STORAGE_TENANT_SERVICES: undefined,
			},
			async () => {
				expect(resolveStorageConnectionTargetForScope()).toEqual({
					kind: "tcp",
					host: "fixed-storage",
					port: 9000,
				});
			},
		);
	});
});
