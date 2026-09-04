import { expect, test } from "bun:test";
import { resolveMethodAccess } from "nrpc";
import { OAuthServiceImpl } from "./service";

test("gateway OAuth methods accept the service token", () => {
	for (const method of [
		"getProvider",
		"listEnabledProviders",
		"consumeState",
		"generateState",
	]) {
		expect(resolveMethodAccess(OAuthServiceImpl.prototype, method)).toBe(
			"internal",
		);
	}
});
