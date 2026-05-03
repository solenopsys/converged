import { describe, expect, test } from "bun:test";
import {
	getCurrentStorageScope,
	resolveRequestScopeFromHeaders,
	runWithRequestScopeContext,
} from "./request-context";
import { resolveStorageConnectionTargetForScope } from "./stores/create";

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

	test("keeps request scoped value in async local storage", async () => {
		await runWithRequestScopeContext({ scope: "tenant-a" }, async () => {
			await Promise.resolve();
			expect(getCurrentStorageScope()).toBe("tenant-a");
		});
	});

	test("resolves storage endpoint from tenant services by scope", () => {
		const previous = process.env.STORAGE_TENANT_SERVICES;
		process.env.STORAGE_TENANT_SERVICES = JSON.stringify({
			default: { host: "storage-default", port: 9000 },
			"tenant-a": { host: "storage-a", port: 9001 },
			"tenant-b": "tcp:storage-b:9002",
		});

		try {
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
		} finally {
			if (previous === undefined) {
				delete process.env.STORAGE_TENANT_SERVICES;
			} else {
				process.env.STORAGE_TENANT_SERVICES = previous;
			}
		}
	});
});
