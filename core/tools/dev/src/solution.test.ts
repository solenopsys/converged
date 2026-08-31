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
		"ses",
		"markdown",
		"struct",
		"galery",
		"assistant",
		"calls",
		"contexts",
		"threads",
		"dag",
		"files",
		"store",
		"compressors",
		"requests",
	]);
	expect(resolved.solution.spec.microfrontends).toEqual([
		"auth",
		"assistants",
		"calls",
		"contexts",
		"threads",
		"requests",
	]);
	expect(resolved.solution.spec.processors).toEqual([
		"curaengine",
		"opencamlib",
	]);
	expect(resolved.solution.spec.workflows).toEqual([
		{
			id: "files-process",
			name: "wf-files-process",
			script: "workflows/wf-files-process.js",
			brief: "Process uploaded files",
			description:
				"Unpack ZIP archives, identify model files, and create a manufacturing request from them.",
			parameters: {
				type: "object",
				properties: {
					fileIds: { type: "array", items: { type: "string" } },
				},
				required: ["fileIds"],
			},
		},
		{
			id: "file-unpack",
			name: "wf-file-unpack",
			script: "workflows/wf-file-unpack.js",
			brief: "Unpack an uploaded archive",
			description: "Extract a ZIP archive and return IDs of its entries.",
			parameters: {
				type: "object",
				properties: { fileId: { type: "string" } },
				required: ["fileId"],
			},
		},
	]);
});
