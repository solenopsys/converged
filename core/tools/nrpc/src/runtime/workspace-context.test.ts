import { describe, expect, test } from "bun:test";
import { getCurrentRequestScope } from "back-core/request-context";
import { getCurrentWorkspace, runWithWorkspaceContext } from "./workspace-context";
import type { WorkspaceContext } from "./workspace-context-registry";

// Workspace and scope are ambient request state, so they are exercised the way
// a service sees them: inside the context, by calling the service. How a call
// arrives — headers, a client, a socket — is the transport's business and is
// not what these assertions are about.

class WorkspaceTestService {
	currentWorkspace(): string | null {
		return getCurrentWorkspace() ?? null;
	}

	currentScope(): string | null {
		return getCurrentRequestScope() ?? null;
	}
}

function runInContext<T>(context: WorkspaceContext, callback: () => T): T {
	return runWithWorkspaceContext(context, callback);
}

describe("Workspace context", () => {
	const service = new WorkspaceTestService();

	test("a service sees the workspace of its request", () => {
		expect(runInContext({ workspace: "acme" }, () => service.currentWorkspace())).toBe("acme");
	});

	test("an explicit scope reaches the service unchanged", () => {
		expect(
			runInContext({ workspace: "acme", scope: "acme-data" }, () => service.currentScope()),
		).toBe("acme-data");
	});

	test("scope falls back to the workspace when not given", () => {
		expect(runInContext({ workspace: "acme" }, () => service.currentScope())).toBe("acme");
	});

	test("outside any request there is no workspace or scope", () => {
		expect(service.currentWorkspace()).toBeNull();
		expect(service.currentScope()).toBeNull();
	});

	test("shares context with a separately bundled registry", async () => {
		const duplicate = await import(
			`./workspace-context-registry.ts?bundle=${Date.now()}`
		);

		runInContext(
			{ workspace: "acme", scope: "acme-data", user: "user-1" },
			() => {
				expect(duplicate.getCurrentWorkspaceContext()).toMatchObject({
					workspace: "acme",
					scope: "acme-data",
					user: "user-1",
				});
			},
		);
	});
});
