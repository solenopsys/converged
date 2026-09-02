import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { createFileUniverse } from "../../../core/dag/lib/mock-services";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

describe("wf-files-process", () => {
	test("expands an archive and classifies what came out", () => {
		const u = createFileUniverse();
		const zipId = u.addArchive("upload.zip", [
			{ name: "part.stl", data: "solid part" },
			{ name: "readme.txt", data: "notes" },
		]);

		const outcome = runWorkflow(source, { fileIds: [zipId] }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.errors).toEqual([]);
		expect(outcome.result.files).toEqual([
			expect.objectContaining({ fileId: zipId, archive: true }),
		]);
		expect(
			outcome.result.extracted[0].entries.map(
				(entry: { name: string }) => entry.name,
			),
		).toEqual(["part.stl", "readme.txt"]);

		// both entries are reported, only the STL is flagged as a model
		expect(
			outcome.result.contents.map((file: { name: string; model: boolean }) => [
				file.name,
				file.model,
			]),
		).toEqual([
			["part.stl", true],
			["readme.txt", false],
		]);
		expect(outcome.result.modelFileIds).toHaveLength(1);
		expect(outcome.result.collections[zipId]).toBeDefined();
	});

	test("intake never creates a request and never analyses", () => {
		const u = createFileUniverse();
		const fileId = u.addFile("part.stl", "solid part");

		const outcome = runWorkflow(source, { fileIds: [fileId] }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.modelFileIds).toEqual([fileId]);
		expect(outcome.result.contents).toEqual([
			expect.objectContaining({ fileId, model: true }),
		]);
		// deciding this is a request belongs to the assistant, analysis to
		// wf-request-analyze — intake only reads metadata
		expect(u.calls).toEqual(["files.get"]);
		expect(u.requests.size).toBe(0);
	});

	test("a non-model upload is reported without a model flag", () => {
		const u = createFileUniverse();
		const zipId = u.addArchive("notes.zip", [
			{ name: "readme.txt", data: "notes" },
		]);

		const outcome = runWorkflow(source, { fileIds: [zipId] }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.extracted).toHaveLength(1);
		expect(outcome.result.modelFileIds).toEqual([]);
		expect(u.calls).not.toContain("requests.createRequest");
	});
});
