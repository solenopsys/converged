// wf-sales-import on the real VM core (librt-mock.so) with mocked rp-files /
// rp-sales and a mocked LLM hub. Build the library first:
//   cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";
import { createImportUniverse } from "./mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

const CSV = "company,email\nAcme,owner@acme.test\nBeta,hi@beta.test";

const PARSED = [
	{ company: "Acme", contacts: [{ type: "EMAIL", value: "owner@acme.test" }] },
	{ company: "Beta", contacts: [{ type: "EMAIL", value: "hi@beta.test" }] },
];

function seed() {
	const u = createImportUniverse();
	u.addFile("file-1", "leads.csv", CSV);
	u.setParsed(PARSED);
	return u;
}

const llm = (text: string) => (request: any) => ({
	provider: request.provider,
	model: request.model,
	text,
	toolCalls: [],
	finishReason: "stop",
	usage: { input: 0, output: 0 },
});

describe("wf-sales-import", () => {
	test("reads a file, parses it and inserts the leads and contacts", () => {
		const u = seed();

		const outcome = runWorkflow(source, { fileIds: ["file-1"] }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const r = outcome.result;
		expect(r.status).toBe("imported");
		expect(r.format).toBe("delimited");
		expect(r.parsed).toBe(2);
		expect(r.leadsCreated).toBe(2);
		expect(r.contactsCreated).toBe(2);
		expect(r.errors).toEqual([]);
		expect(r.sources[0]).toMatchObject({
			fileId: "file-1",
			name: "leads.csv",
			truncated: false,
		});

		expect(u.leads.map((l: any) => l.description)).toEqual(["Acme", "Beta"]);
		expect(u.contacts.map((c: any) => c.value)).toEqual([
			"owner@acme.test",
			"hi@beta.test",
		]);
	});

	test("the LLM pass wins when it returns rows, and the parsers are skipped", () => {
		const u = seed();

		const outcome = runWorkflow(
			source,
			{ fileIds: ["file-1"], provider: "anthropic", model: "claude-opus-5" },
			u.handler,
			{
				llm: llm(
					'```json\n{"leads":[{"company":"Gamma","contacts":[{"type":"EMAIL","value":"g@gamma.test"}]}]}\n```',
				),
			},
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.format).toBe("llm");
		expect(u.leads.length).toBe(1);
		expect(u.leads[0].description).toBe("Gamma");
		expect(u.calls).not.toContain("sales.parseImportLeads");
	});

	test("a failing LLM falls back to the parsers and is recorded", () => {
		const u = seed();

		const outcome = runWorkflow(
			source,
			{ fileIds: ["file-1"], provider: "anthropic", model: "claude-opus-5" },
			u.handler,
			{
				llm: () => {
					throw new Error("hub unreachable");
				},
			},
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.format).toBe("delimited");
		expect(outcome.result.leadsCreated).toBe(2);
		expect(outcome.result.errors[0]).toMatchObject({ stage: "llm" });
		expect(outcome.result.errors[0].message).toContain("hub unreachable");
	});

	test("re-importing the same file skips instead of duplicating", () => {
		const u = seed();
		runWorkflow(source, { fileIds: ["file-1"] }, u.handler);

		const outcome = runWorkflow(source, { fileIds: ["file-1"] }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.leadsCreated).toBe(0);
		expect(outcome.result.leadsSkipped).toBe(2);
		expect(outcome.result.contactsSkipped).toBe(2);
		expect(outcome.result.errors).toEqual([]);
		expect(u.leads.length).toBe(2);
	});

	test("an unreadable file is recorded and the rest still import", () => {
		const u = seed();

		const outcome = runWorkflow(
			source,
			{ fileIds: ["missing", "file-1"] },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.errors[0]).toMatchObject({
			id: "missing",
			stage: "load",
		});
		expect(outcome.result.leadsCreated).toBe(2);
	});

	test("pasted text alone is a valid source", () => {
		const u = createImportUniverse();
		u.setParsed(PARSED);

		const outcome = runWorkflow(source, { rawText: CSV }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.leadsCreated).toBe(2);
		expect(outcome.result.sources).toEqual([]);
	});

	test("tags from the params are assigned to every imported lead", () => {
		const u = seed();

		const outcome = runWorkflow(
			source,
			{ fileIds: ["file-1"], tags: ["batch-7"] },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(u.tags.map((t) => t.tag)).toEqual(["batch-7", "batch-7"]);
	});

	test("no text anywhere returns the empty result", () => {
		const u = createImportUniverse();
		u.addFile("file-1", "empty.csv", "");

		const outcome = runWorkflow(source, { fileIds: ["file-1"] }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("empty");
		expect(u.leads).toEqual([]);
	});

	test("dryRun parses but writes nothing", () => {
		const u = seed();

		const outcome = runWorkflow(
			source,
			{ fileIds: ["file-1"], dryRun: true },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("dry-run");
		expect(outcome.result.parsed).toBe(2);
		expect(outcome.result.items.length).toBe(2);
		expect(u.leads).toEqual([]);
	});

	test("no source at all fails the run loudly", () => {
		const u = createImportUniverse();
		const outcome = runWorkflow(source, {}, u.handler);
		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.error).toContain("params.fileIds or params.rawText");
	});
});
