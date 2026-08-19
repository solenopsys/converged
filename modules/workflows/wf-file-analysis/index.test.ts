// wf-file-analysis (the cascade) on the real VM core (librt-mock.so) with
// mocked services. Build the library first:
//   cd navite/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runWorkflow } from "../../../../navite/apps/centimanus/test/bun/centimanus-mock";
import { buildWorkflow } from "../../core/build";
import { createFileUniverse } from "../lib/mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

describe("wf-file-analysis (cascade)", () => {
	test("unpacks an archive and analyses every extracted file", () => {
		const u = createFileUniverse();
		const zipId = u.addArchive("upload.zip", [
			{ name: "part-a.stl", data: "solid a" },
			{ name: "part-b.stl", data: "solid b" },
			{ name: "readme.txt", data: "docs" },
		]);

		const outcome = runWorkflow(
			source,
			{ fileIds: [zipId], options: { target: "cnc" } },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const report = outcome.result;
		expect(report.errors).toEqual([]);
		expect(report.inputs.length).toBe(1);
		expect(report.inputs[0].detectedType).toBe("zip");
		expect(report.collections[zipId]).toBeDefined();

		// every archive entry went back through the queue
		expect(report.extracted.map((f: any) => f.name)).toEqual([
			"part-a.stl",
			"part-b.stl",
			"readme.txt",
		]);
		// both STL got a preview; the txt got nothing
		const previews = report.converted.filter((c: any) => c.kind === "preview");
		expect(previews.map((p: any) => p.name)).toEqual(["part-a.glb", "part-b.glb"]);
		// and a milling estimate each
		expect(report.estimates.map((e: any) => e.type)).toEqual(["milling", "milling"]);
	});

	test("mixed direct inputs: two stl models, cnc target", () => {
		const u = createFileUniverse();
		const aId = u.addFile("a.stl", "solid a");
		const bId = u.addFile("b.stl", "solid b");

		const outcome = runWorkflow(
			source,
			{ fileIds: [aId, bId], options: { target: "cnc", convertPreview: false } },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.inputs.length).toBe(2);
		expect(outcome.result.estimates.map((e: any) => [e.sourceFileId, e.type])).toEqual([
			[aId, "milling"],
			[bId, "milling"],
		]);
	});

	test("archive recursion depth is limited", () => {
		const u = createFileUniverse();
		// inner archive is an entry of the outer one; depth limit 1 stops it
		const zipId = u.addArchive("outer.zip", [
			{ name: "inner.zip", data: JSON.stringify({ entries: [{ name: "deep.stl", data: "solid d" }] }) },
		]);

		const outcome = runWorkflow(
			source,
			{ fileIds: [zipId], options: { maxArchiveDepth: 1 } },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const messages = outcome.result.errors.map((e: any) => e.message);
		expect(messages).toEqual(["recursion depth exceeded: 1"]);
		// the inner archive was staged but never unzipped
		expect(outcome.result.extracted.map((f: any) => f.name)).toEqual(["inner.zip"]);
	});

	test("one broken file does not stop the others", () => {
		const u = createFileUniverse();
		const missingId = "file-does-not-exist";
		const stlId = u.addFile("ok.stl", "solid ok");

		const outcome = runWorkflow(
			source,
			{ fileIds: [missingId, stlId], options: { target: "cnc", convertPreview: false } },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.errors.length).toBe(1);
		expect(outcome.result.errors[0].stage).toBe("load");
		expect(outcome.result.errors[0].fileId).toBe(missingId);
		// the healthy file still produced its estimate
		expect(outcome.result.estimates.map((e: any) => e.sourceFileId)).toEqual([stlId]);
	});

	test("missing fileIds fails the workflow", () => {
		const u = createFileUniverse();
		const outcome = runWorkflow(source, {}, u.handler);
		expect(outcome.ok).toBe(false);
	});
});
