import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { PROJECT_ROOT } from "./apps";
import { mappingsFrom, resolveSolutionConfig } from "./solution";

test("preserves a workflow type from mapping.json", () => {
	const workflows = mappingsFrom(
		{
			workflows: [
				{
					id: "outreach-send",
					name: "wf-outreach-send",
					script: "workflows/wf-outreach-send.js",
					type: "sales_delivery",
				},
			],
		},
		"mapping.json",
	).get("workflows");

	expect(workflows?.get("outreach-send")?.type).toBe("sales_delivery");
});

test("resolves the configured solution set and workflow links", () => {
	const resolved = resolveSolutionConfig(
		resolve(PROJECT_ROOT, "modules/solutions/converged.json"),
	);

	expect(resolved.solution.spec.repositories).toEqual([
		"access",
		"auth",
		"identity",
		"environment",
		"notify",
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
		"requests",
		"logs",
		"telemetry",
		"counters",
		"usage",
		"dashboard",
		"sheduller",
		"webhooks",
		"community",
		"chats",
		"support",
		// The production floor: orders, the machines that run them, and the
		// event log the two write into.
		"orders",
		"equipment",
		"events",
		"reviews",
		"staff",
		"billing",
		"metering",
		"invoices",
	]);
	expect(resolved.solution.spec.lambdas).toEqual([
		"ses",
		"compressors",
		// wf-file-analyze converts every model to a GLB through it: without the
		// lambda there is no preview to attach and no card to draw.
		"modelconvertor",
	]);
	expect(resolved.solution.spec.surfaces).toEqual([
		"auth",
		"assistants",
		"calls",
		"contexts",
		"threads",
		"requests",
		"files",
		"logs",
		"telemetry",
		"usage",
		"dasboards",
		"automation",
		"community",
		"chats",
		"support",
		"orders",
		"equipment",
		"reviews",
		"team",
	]);
	expect(resolved.solution.spec.processors).toEqual([
		"curaengine",
		"opencamlib",
	]);
	expect(resolved.solution.spec.workflows.map(({ id }) => id)).toEqual([
		"files-process",
		"file-unpack",
		"file-analyze",
		"files-analyze",
		"request-analyze",
		"request-to-order",
		"equipment-incident",
		"order-review-request",
		"order-review-followup",
		"team-invite",
		"payment-settle",
	]);
	// The published and the internal shape, on the file workflows that have
	// both; the product workflows after them are checked by their own tests.
	expect(resolved.solution.spec.workflows.slice(0, 2)).toEqual([
		{
			id: "files-process",
			name: "wf-files-process",
			script: "workflows/wf-files-process.js",
			type: "system",
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
			paramsExample: { fileIds: ["<file-id>"] },
		},
		{
			id: "file-unpack",
			name: "wf-file-unpack",
			script: "workflows/wf-file-unpack.js",
			type: "system",
			brief: "Unpack an uploaded archive",
			description: "Extract a ZIP archive and return IDs of its entries.",
			parameters: {
				type: "object",
				properties: { fileId: { type: "string" } },
				required: ["fileId"],
			},
			paramsExample: { fileId: "<file-id>" },
		},
	]);
	// Every workflow carries admin metadata: brief, description, parameters
	// and a valid example for the run form.
	for (const workflow of resolved.solution.spec.workflows) {
		expect(workflow.brief).toBeString();
		expect(workflow.description).toBeString();
		expect(workflow.parameters).toBeObject();
		expect(workflow.paramsExample).toBeObject();
	}
});
