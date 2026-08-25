// wf-file-unpack on the real VM core (librt-mock.so) with mocked services.
// Build the library first: cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";
import { buildWorkflow } from "../../../core/dag/core/build";
import { createFileUniverse } from "../../../core/dag/lib/mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

describe("wf-file-unpack", () => {
	test("unzips an archive into a collection", () => {
		const u = createFileUniverse();
		const zipId = u.addArchive("models.zip", [
			{ name: "part-a.stl", data: "solid a" },
			{ name: "notes.txt", data: "hello" },
		]);

		const outcome = runWorkflow(source, { fileId: zipId }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const report = outcome.result;
		expect(report.errors).toEqual([]);
		expect(report.type).toBe("zip");
		expect(report.entries.map((e: any) => e.name)).toEqual(["part-a.stl", "notes.txt"]);
		// the collection was registered and the entries persisted under it
		expect(u.collections.size).toBe(1);
		const entryIds = report.entries.map((e: any) => e.fileId);
		for (const id of entryIds) {
			expect(u.files.get(id)?.collectionId).toBe(report.collectionId);
		}
		expect(u.calls).toEqual([
			"files.materialize",
			"files.detectType",
			"files.saveCollection",
			"files.unzip",
		]);
	});

	test("a non-archive is reported, nothing is unzipped", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("part.stl", "solid a");

		const outcome = runWorkflow(source, { fileId: stlId }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.type).toBe("stl");
		expect(outcome.result.entries).toEqual([]);
		expect(outcome.result.errors).toEqual([
			{ stage: "archive", fileId: stlId, message: "not an archive: stl" },
		]);
		expect(u.calls).toEqual(["files.materialize", "files.detectType"]);
	});

	test("an unzip failure is recorded, the collection survives", () => {
		const u = createFileUniverse();
		const zipId = u.addArchive("broken.zip", []);
		u.failOn("files", "unzip", "corrupt central directory");

		const outcome = runWorkflow(source, { fileId: zipId }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.entries).toEqual([]);
		expect(outcome.result.errors.length).toBe(1);
		expect(outcome.result.errors[0].stage).toBe("archive");
		expect(u.collections.size).toBe(1);
	});

	test("missing fileId fails the workflow", () => {
		const u = createFileUniverse();
		const outcome = runWorkflow(source, {}, u.handler);
		expect(outcome.ok).toBe(false);
	});
});
