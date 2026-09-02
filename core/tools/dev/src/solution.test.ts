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
				"Expand ZIP archives and classify every uploaded file, reporting which of them are production models. Does not create a request.",
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
		// Reached only through rt.sub / ms-requests, never by the assistant:
		// without brief, description and parameters the chat catalog skips
		// them, while ms-dag still resolves their source for centimanus.
		{
			id: "file-analyze",
			name: "wf-file-analyze",
			script: "workflows/wf-file-analyze.js",
		},
		{
			id: "request-analyze",
			name: "wf-request-analyze",
			script: "workflows/wf-request-analyze.js",
		},
	]);
});
