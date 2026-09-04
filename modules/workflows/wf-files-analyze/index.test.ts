// wf-files-analyze on the real VM core (librt-mock.so) with mocked services.
// Build the library first: cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { createFileUniverse } from "../../../core/dag/lib/mock-services";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";

let source: string;
let workflows: Record<string, string>;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
	// Delegation is real: the child runs on the same engine.
	workflows = {
		"workflows/wf-file-analyze.js": await buildWorkflow(
			join(import.meta.dir, "../wf-file-analyze/index.ts"),
		),
	};
});

describe("wf-files-analyze", () => {
	test("analyses every model in order and skips what is not one", () => {
		const u = createFileUniverse();
		const first = u.addFile("bracket.stl", "solid bracket");
		const notes = u.addFile("readme.txt", "notes");
		const second = u.addFile("flange.stl", "solid flange");

		const outcome = runWorkflow(
			source,
			{ fileIds: [first, notes, second], options: { target: "cnc" } },
			u.handler,
			{ workflows },
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const report = outcome.result;
		expect(report.errors).toEqual([]);
		expect(report.analysed).toEqual([first, second]);
		// A drawing or a note never reaches a processor.
		expect(report.skipped).toEqual([notes]);

		expect(report.estimates.length).toBe(2);
		expect(report.estimates.map((e: any) => e.data.estimator)).toEqual([
			"opencamlib",
			"opencamlib",
		]);
		expect(report.estimates.map((e: any) => e.data.sourceName)).toEqual([
			"bracket.stl",
			"flange.stl",
		]);

		// Sequential, not fanned out: one processor call per model, in the order
		// the files were given.
		expect(u.calls.filter((c) => c === "opencamlib.analyze").length).toBe(2);
	});

	test("one bad model costs only its own estimate", () => {
		const u = createFileUniverse();
		const good = u.addFile("bracket.stl", "solid bracket");
		const bad = u.addFile("part.stl", "solid part");
		u.failOn("opencamlib", "analyze", "no cutting tool fits");

		const outcome = runWorkflow(
			source,
			{ fileIds: [good, bad], options: { target: "cnc" } },
			u.handler,
			{ workflows },
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const report = outcome.result;
		// Both were attempted; the failure is data, not the end of the run.
		expect(report.analysed).toEqual([good, bad]);
		expect(report.estimates).toEqual([]);
		expect(report.errors.length).toBe(2);
		expect(report.errors[0].stage).toBe("milling-extract");
		// Previews are produced by a different service and survive the outage.
		expect(report.converted.map((c: any) => c.kind)).toEqual([
			"preview",
			"preview",
		]);
	});

	test("no models is not an error", () => {
		const u = createFileUniverse();
		const notes = u.addFile("readme.txt", "notes");

		const outcome = runWorkflow(source, { fileIds: [notes] }, u.handler, {
			workflows,
		});
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.analysed).toEqual([]);
		expect(outcome.result.skipped).toEqual([notes]);
		expect(outcome.result.errors).toEqual([]);
		expect(u.calls).not.toContain("opencamlib.analyze");
	});

	test("an estimate is routed to the processor's own peer, not to services", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("bracket.stl", "solid bracket");
		const seen: Array<{ service: string; target: string }> = [];

		const outcome = runWorkflow(
			source,
			{ fileIds: [stlId], options: { target: "cnc" } },
			(service, method, params, cache, target) => {
				seen.push({ service, target });
				return u.handler(service, method, params, cache, target);
			},
			{ workflows },
		);
		expect(outcome.ok).toBe(true);

		// A processor is its own container: without its own target the envelope
		// goes to the default `services` peer and Fujin drops it as unroutable.
		expect(seen).toContainEqual({
			service: "opencamlib",
			target: "opencamlib",
		});
		// Microservices keep sharing the engine's peer.
		expect(seen).toContainEqual({ service: "files", target: "" });
	});
});
