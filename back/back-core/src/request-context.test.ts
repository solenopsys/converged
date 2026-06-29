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

	test("reads the edge-injected storage scope header (no host mapping)", () => {
		expect(
			resolveRequestScopeFromHeaders({
				"x-storage-scope": "democnc",
				"x-forwarded-host": "democnc.4ir.club",
			}),
		).toBe("democnc");
	});

	test("keeps request scoped value in async local storage", async () => {
		await runWithRequestScopeContext({ scope: "tenant-a" }, async () => {
			await Promise.resolve();
			expect(getCurrentStorageScope()).toBe("tenant-a");
		});
	});

	test("uses request scope header as storage scope fallback", async () => {
		await runWithRequestScopeContext(
			{ headers: { "x-storage-scope": "democnc" } },
			async () => {
				await Promise.resolve();
				expect(getCurrentStorageScope()).toBe("democnc");
			},
		);
	});

	test("does not read legacy domain-map settings when only host is present", () => {
		expect(
			resolveRequestScopeFromHeaders({
				host: "localhost:3001",
			}),
		).toBeUndefined();
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

	test("registers stores without connecting to default storage outside request scope", async () => {
		await withEnv(
			{
				STORAGE_TENANT_SERVICES: JSON.stringify({
					democnc: { host: "converged-storage-democnc", port: 9000 },
				}),
				NRPC_WORKSPACE: "default",
				STORAGE_SCOPE: undefined,
			},
			async () => {
				const stores = new TestStoresController("test-ms");
				await expect(stores.init()).resolves.toBeUndefined();
			},
		);
	});

	test("fails storage operations without scope", async () => {
		await withEnv(
			{
				STORAGE_TENANT_SERVICES: JSON.stringify({
					democnc: { host: "converged-storage-democnc", port: 9000 },
				}),
				NRPC_WORKSPACE: "default",
				STORAGE_SCOPE: undefined,
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

	test("resolves storage host from the tenant-services mapping by scope", () => {
		withEnv(
			{
				STORAGE_TENANT_SERVICES: JSON.stringify({
					democnc: { host: "converged-storage-democnc", port: 9000 },
				}),
				STORAGE_SCOPE: undefined,
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

	test("fails when the scope has no entry in the mapping", () => {
		withEnv(
			{
				STORAGE_TENANT_SERVICES: JSON.stringify({
					democnc: { host: "converged-storage-democnc", port: 9000 },
				}),
				STORAGE_SCOPE: undefined,
			},
			() => {
				expect(() => resolveStorageConnectionTargetForScope("unknown")).toThrow(
					/No storage endpoint for scope "unknown"/,
				);
			},
		);
	});
});
