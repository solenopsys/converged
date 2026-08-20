import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { PROJECT_ROOT } from "./apps";
import { resolveSolutionConfig } from "./solution";

test("resolves the configured solution set and workflow links", () => {
	const resolved = resolveSolutionConfig(
		resolve(PROJECT_ROOT, "modules/solutions/converged.json"),
	);

	expect(resolved.solution.spec.microservices).toEqual([
		"access",
		"auth",
		"identity",
		"oauth",
		"markdown",
		"struct",
		"galery",
		"agent",
		"assistant",
		"calls",
		"chats",
		"contexts",
		"threads",
		"logs",
		"telemetry",
		"counters",
		"usage",
		"files",
		"store",
		"requests",
	]);
	expect(resolved.solution.spec.microfrontends).toEqual([
		"auth",
		"markdown",
		"struct",
		"galery",
		"landing",
		"docs",
		"agents",
		"assistants",
		"calls",
		"chats",
		"contexts",
		"threads",
		"logs",
		"telemetry",
		"usage",
		"requests",
	]);
	expect(resolved.solution.spec.processors).toEqual(["curaengine", "opencam"]);
	expect(resolved.solution.spec.workflows).toEqual([
		{ name: "wf-file-analysis", script: "workflows/wf-file-analysis.js" },
		{ name: "wf-file-unpack", script: "workflows/wf-file-unpack.js" },
	]);
});
