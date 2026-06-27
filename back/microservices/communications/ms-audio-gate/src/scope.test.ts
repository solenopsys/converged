import { afterEach, describe, expect, test } from "bun:test";
import { resolveAudioGateScope } from "./scope";

const previousDomainMap = process.env.WORKSPACE_DOMAIN_MAP;

afterEach(() => {
	if (previousDomainMap === undefined) {
		delete process.env.WORKSPACE_DOMAIN_MAP;
	} else {
		process.env.WORKSPACE_DOMAIN_MAP = previousDomainMap;
	}
});

describe("resolveAudioGateScope", () => {
	test("maps an explicit tenant domain to the operator workspace", () => {
		process.env.WORKSPACE_DOMAIN_MAP = JSON.stringify({
			"democnc.4ir.local": "democnc",
		});

		expect(resolveAudioGateScope("democnc.4ir.local", undefined)).toBe(
			"democnc",
		);
	});

	test("preserves an explicit workspace", () => {
		process.env.WORKSPACE_DOMAIN_MAP = JSON.stringify({
			"democnc.4ir.local": "democnc",
		});

		expect(resolveAudioGateScope("democnc", undefined)).toBe("democnc");
	});

	test("resolves scope from the websocket host when query scope is absent", () => {
		process.env.WORKSPACE_DOMAIN_MAP = JSON.stringify({
			"democnc.4ir.local": "democnc",
		});

		expect(
			resolveAudioGateScope(undefined, {
				"x-forwarded-host": "democnc.4ir.local",
			}),
		).toBe("democnc");
	});
});
