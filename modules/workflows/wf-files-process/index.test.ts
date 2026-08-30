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
	test("unpacks an archive and creates a request for model files", () => {
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
		expect(outcome.result.modelFileIds).toHaveLength(1);
		expect(outcome.result.requestId).toBeDefined();
		expect(u.requests.get(outcome.result.requestId)?.files).toEqual({
			"part.stl": outcome.result.modelFileIds[0],
		});
		expect(u.calls).toContain("compressors.unpack");
		expect(u.calls).toContain("requests.createRequest");
		expect(u.calls).not.toContain("modelconvertor.convert");
		expect(u.calls).not.toContain("ptah.analyze");
	});

	test("creates a request for a direct model file", () => {
		const u = createFileUniverse();
		const fileId = u.addFile("part.stl", "solid part");

		const outcome = runWorkflow(source, { fileIds: [fileId] }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.files).toEqual([
			expect.objectContaining({ fileId, archive: false }),
		]);
		expect(outcome.result.extracted).toEqual([]);
		expect(outcome.result.modelFileIds).toEqual([fileId]);
		expect(outcome.result.requestId).toBeDefined();
		expect(u.calls).toEqual(["files.get", "requests.createRequest"]);
	});

	test("does not create a request when an archive has no model files", () => {
		const u = createFileUniverse();
		const zipId = u.addArchive("notes.zip", [
			{ name: "readme.txt", data: "notes" },
		]);

		const outcome = runWorkflow(source, { fileIds: [zipId] }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.extracted).toHaveLength(1);
		expect(outcome.result.modelFileIds).toEqual([]);
		expect(outcome.result.requestId).toBeUndefined();
		expect(u.calls).not.toContain("requests.createRequest");
	});
});
