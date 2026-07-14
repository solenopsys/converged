import { describe, expect, test } from "bun:test";
import { resolveSignalScope } from "./plugin";

describe("ms-signal scope", () => {
	test("prefers the ingress-injected storage scope", () => {
		expect(
			resolveSignalScope(
				{ workspace: "workspace-a", "x-storage-scope": "tenant-a" },
				"local-tenant",
			),
		).toBe("tenant-a");
	});

	test("uses the pinned local scope when the edge header is absent", () => {
		expect(resolveSignalScope({}, "local-tenant")).toBe("local-tenant");
	});

	test("rejects an unscoped deployment", () => {
		expect(resolveSignalScope({}, "  ")).toBeUndefined();
	});
});
