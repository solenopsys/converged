import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import {
	createFileUniverse,
	type FileUniverse,
} from "../../../core/dag/lib/mock-services";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

type StoredRequest = {
	files: Record<string, string>;
	fields: Record<string, unknown[]>;
};

// The assistant's only job: it decided these files are a request.
function seedRequest(u: FileUniverse, files: Record<string, string>): string {
	return u.handler(
		"requests",
		"createRequest",
		{ input: { source: "assistant", fields: {}, files } },
		new Map(),
	) as string;
}

const stored = (u: FileUniverse, id: string) =>
	u.requests.get(id) as unknown as StoredRequest;

describe("wf-request-analyze", () => {
	test("analyses the request's models and writes the result back", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("bracket.stl", "solid bracket");
		const requestId = seedRequest(u, { "bracket.stl": stlId });

		const outcome = runWorkflow(source, { requestId }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.errors).toEqual([]);
		expect(outcome.result.analysed).toEqual([stlId]);
		expect(outcome.result.attached).toBe(true);

		expect(outcome.result.estimates).toHaveLength(1);
		expect(outcome.result.estimates[0].type).toBe("milling");
		expect(outcome.result.estimates[0].data.estimator).toBe("ptah:opencamlib");
		expect(outcome.result.estimates[0].data.sourceName).toBe("bracket.stl");

		const request = stored(u, requestId);
		// the GLB preview joined the request so the detail view can render it
		expect(Object.keys(request.files).sort()).toEqual([
			"bracket.glb",
			"bracket.stl",
		]);
		expect(request.fields.file_analysis_estimates).toEqual(
			outcome.result.estimates,
		);
		expect(request.fields.file_analysis_errors).toEqual([]);
		expect(u.calls).toContain("ptah.analyze");
		expect(u.calls).toContain("requests.applyRequestUpdate");
	});

	test("non-model request files are left alone", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("part.stl", "solid part");
		const noteId = u.addFile("notes.txt", "hand notes");
		const requestId = seedRequest(u, {
			"part.stl": stlId,
			"notes.txt": noteId,
		});

		const outcome = runWorkflow(source, { requestId }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.analysed).toEqual([stlId]);
		// the note was classified from metadata only — never staged
		expect(u.calls.filter((call) => call === "files.materialize")).toHaveLength(
			1,
		);
	});

	test("a failing estimator still attaches the error to the request", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("part.stl", "solid part");
		const requestId = seedRequest(u, { "part.stl": stlId });
		u.failOn("ptah", "analyze", "no cutting tool fits");

		const outcome = runWorkflow(source, { requestId }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.estimates).toEqual([]);
		expect(outcome.result.errors).toEqual([
			{
				stage: "milling-extract",
				fileId: stlId,
				message: "no cutting tool fits",
			},
		]);
		expect(outcome.result.attached).toBe(true);

		const request = stored(u, requestId);
		expect(request.fields.file_analysis_errors).toEqual(outcome.result.errors);
		// the preview survived the failed estimate
		expect(Object.keys(request.files)).toContain("part.glb");
	});

	test("a second run does not analyse the previews the first run created", () => {
		const u = createFileUniverse();
		const stlId = u.addFile("bracket.stl", "solid bracket");
		const requestId = seedRequest(u, { "bracket.stl": stlId });

		expect(runWorkflow(source, { requestId }, u.handler).ok).toBe(true);
		expect(Object.keys(stored(u, requestId).files)).toContain("bracket.glb");

		// the GLB is model/gltf-binary, but it is preview output, not an input
		const again = runWorkflow(source, { requestId }, u.handler);
		expect(again.ok).toBe(true);
		if (!again.ok) return;
		expect(again.result.analysed).toEqual([stlId]);
		expect(again.result.estimates).toHaveLength(1);
	});

	test("an unknown request fails cleanly without touching files", () => {
		const u = createFileUniverse();

		const outcome = runWorkflow(source, { requestId: "nope" }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.analysed).toEqual([]);
		expect(outcome.result.attached).toBe(false);
		expect(outcome.result.errors).toEqual([
			{ stage: "request", fileId: "nope", message: "Request not found: nope" },
		]);
	});
});
