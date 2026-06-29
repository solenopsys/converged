import { describe, expect, test } from "bun:test";
import { resolveAudioGateScope } from "./scope";

describe("resolveAudioGateScope", () => {
	test("trusts an explicit query scope as-is (no domain mapping)", () => {
		expect(resolveAudioGateScope("democnc", undefined)).toBe("democnc");
	});

	test("prefers injected scope when legacy query scope is a host", () => {
		expect(
			resolveAudioGateScope("democnc.4ir.local", {
				"x-storage-scope": "democnc",
			}),
		).toBe("democnc");
	});

	test("normalizes legacy host-like query scope when no injected header exists", () => {
		expect(resolveAudioGateScope("democnc.4ir.local", undefined)).toBe(
			"democnc",
		);
	});

	test("reads the edge-injected storage scope header", () => {
		expect(
			resolveAudioGateScope(undefined, {
				"x-storage-scope": "democnc",
			}),
		).toBe("democnc");
	});

	test("reads the workspace header (nrpc wire term)", () => {
		expect(resolveAudioGateScope(undefined, { workspace: "democnc" })).toBe(
			"democnc",
		);
	});

	test("returns undefined when no scope is present", () => {
		expect(
			resolveAudioGateScope(undefined, {
				"x-forwarded-host": "democnc.4ir.local",
			}),
		).toBeUndefined();
	});
});
