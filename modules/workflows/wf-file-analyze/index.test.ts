// wf-file-analyze on the real VM core (librt-mock.so) with mocked services.
// Build the library first: cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { createFileUniverse } from "../../../core/dag/lib/mock-services";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

describe("wf-file-analyze", () => {
	test("stl + cnc: GLB preview and a milling estimate with gcode artifact", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("bracket.stl", "solid bracket");

		const outcome = runWorkflow(
			source,
			{ fileId: stlId, options: { target: "cnc", includeGcode: true } },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const report = outcome.result;
		expect(report.errors).toEqual([]);
		expect(report.file.detectedType).toBe("stl");

		// one preview + one gcode artifact, both persisted as files
		const kinds = report.converted.map((c: any) => c.kind);
		expect(kinds).toEqual(["preview", "gcode"]);
		expect(report.converted[0].name).toBe("bracket.glb");

		expect(report.estimates.length).toBe(1);
		expect(report.estimates[0].type).toBe("milling");
		expect(report.estimates[0].data.estimator).toBe("opencamlib");
		expect(report.estimates[0].data.totalTimeSec).toBe(21.2);
		expect(report.estimates[0].artifactFileIds.length).toBe(1);
		// the model rode to the processor by CacheRef, not inline
		expect(u.calls).toContain("opencamlib.analyze");
	});

	test("stl + print without a definition: no native estimator, recorded error", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("vase.stl", "solid vase");

		const outcome = runWorkflow(
			source,
			{ fileId: stlId, options: { target: "print", convertPreview: false } },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.converted).toEqual([]);
		expect(outcome.result.estimates).toEqual([]);
		expect(outcome.result.errors).toEqual([
			{
				stage: "print-estimate",
				fileId: stlId,
				message: "no native print estimator without a definition file",
			},
		]);
		expect(u.calls).toEqual(["files.materialize", "files.detectType"]);
	});

	test("stl + print with a definition: curaengine slice", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("vase.stl", "solid vase");
		const defId = u.addFile("printer.def.json", '{"version":2}');

		const outcome = runWorkflow(
			source,
			{
				fileId: stlId,
				options: {
					target: "print",
					convertPreview: false,
					includeGcode: true,
					definitionFileId: defId,
				},
			},
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.estimates.length).toBe(1);
		expect(outcome.result.estimates[0].type).toBe("printing");
		expect(outcome.result.estimates[0].data.estimator).toBe("curaengine");
		// gcode came back as a ref and was persisted as a file
		expect(outcome.result.converted.map((c: any) => c.kind)).toEqual(["gcode"]);
	});

	test("a raw gcode file has no estimator", () => {
		const u = createFileUniverse();
		const gcodeId = u.addFile("part.gcode", "G1 X0");

		const outcome = runWorkflow(
			source,
			{ fileId: gcodeId, options: { target: "print" } },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.estimates).toEqual([]);
		expect(outcome.result.errors).toEqual([]);
	});

	test("an archive is redirected to wf-file-unpack", () => {
		const u = createFileUniverse();
		const zipId = u.addArchive("models.zip", [
			{ name: "a.stl", data: "solid a" },
		]);

		const outcome = runWorkflow(source, { fileId: zipId }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.estimates).toEqual([]);
		expect(outcome.result.errors).toEqual([
			{
				stage: "load",
				fileId: zipId,
				message: "archives are handled by wf-file-unpack",
			},
		]);
	});

	test("a failing estimator is an error entry, preview still persists", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("part.stl", "solid p");
		u.failOn("opencamlib", "analyze", "no cutting tool fits");

		const outcome = runWorkflow(
			source,
			{ fileId: stlId, options: { target: "cnc" } },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.converted.map((c: any) => c.kind)).toEqual([
			"preview",
		]);
		expect(outcome.result.estimates).toEqual([]);
		expect(outcome.result.errors.length).toBe(1);
		expect(outcome.result.errors[0].stage).toBe("milling-extract");
	});
});
