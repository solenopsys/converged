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
		"ses",
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
		"dag",
		"files",
		"store",
		"compressors",
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
	expect(resolved.solution.spec.processors).toEqual([
		"curaengine",
		"opencamlib",
	]);
	expect(
		resolved.solution.spec.workflows.map(({ id, name, script }) => ({
			id,
			name,
			script,
		})),
	).toEqual([
		{
			id: "files-process",
			name: "wf-files-process",
			script: "workflows/wf-files-process.js",
		},
		{
			id: "file-unpack",
			name: "wf-file-unpack",
			script: "workflows/wf-file-unpack.js",
		},
	]);
	expect(resolved.solution.spec.workflows[0]?.parameters).toEqual({
		type: "object",
		properties: {
			fileIds: { type: "array", items: { type: "string" } },
		},
		required: ["fileIds"],
	});
});
