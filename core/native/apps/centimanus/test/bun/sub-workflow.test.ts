// rt.sub — a smart workflow delegating one step to a dumb one, on the real VM.
// Build the library first: cd ../.. && zig build mock -Dtarget=x86_64-linux-gnu

import { describe, expect, test } from "bun:test";
import { runWorkflow } from "./centimanus-mock";

// The dumb child: one file, one operation.
const UNPACK = `
rt.workflow = function (params) {
  var entries = rt.node("unzip", function () {
    return rt.call("compressors", "unpack", { fileId: params.fileId });
  });
  return { fileId: params.fileId, entries: entries };
};
`;

// The smart parent: meta-logic only, the work is delegated per file.
const INTAKE = `
rt.workflow = function (params) {
  var out = [];
  for (var i = 0; i < params.fileIds.length; i++) {
    var id = params.fileIds[i];
    var child = rt.subAttempt("unpack:" + id, "workflows/wf-file-unpack.js", { fileId: id });
    if (child.ok) out.push({ fileId: id, entries: child.value.entries });
    else out.push({ fileId: id, error: child.error });
  }
  return { processed: out };
};
`;

describe("rt.sub", () => {
	test("a parent delegates one node per file to a child workflow", () => {
		const calls: string[] = [];
		const outcome = runWorkflow(
			INTAKE,
			{ fileIds: ["a.zip", "b.zip"] },
			(service, method, params) => {
				calls.push(`${service}.${method}:${params.fileId}`);
				return [`${params.fileId}/part.stl`];
			},
			{ workflows: { "workflows/wf-file-unpack.js": UNPACK } },
		);

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.processed).toEqual([
			{ fileId: "a.zip", entries: ["a.zip/part.stl"] },
			{ fileId: "b.zip", entries: ["b.zip/part.stl"] },
		]);
		// each child really ran, once, in order
		expect(calls).toEqual([
			"compressors.unpack:a.zip",
			"compressors.unpack:b.zip",
		]);
	});

	test("a delegated result is cached, so the parent's replay never re-runs it", () => {
		let ran = 0;
		const outcome = runWorkflow(
			INTAKE,
			{ fileIds: ["a.zip", "b.zip", "c.zip"] },
			() => {
				ran += 1;
				return ["part.stl"];
			},
			{ workflows: { "workflows/wf-file-unpack.js": UNPACK } },
		);

		expect(outcome.ok).toBe(true);
		// three children, three calls — the parent re-evaluates its script once
		// per step but replays finished delegations from the store
		expect(ran).toBe(3);
	});

	test("a child failure is data the parent can survive", () => {
		const outcome = runWorkflow(
			INTAKE,
			{ fileIds: ["good.zip", "bad.zip"] },
			(_service, _method, params) => {
				if (params.fileId === "bad.zip") throw new Error("corrupt archive");
				return ["part.stl"];
			},
			{ workflows: { "workflows/wf-file-unpack.js": UNPACK } },
		);

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.processed[0].entries).toEqual(["part.stl"]);
		expect(outcome.result.processed[1].error).toContain("corrupt archive");
	});

	test("an unregistered script fails the delegation, not the process", () => {
		const outcome = runWorkflow(
			INTAKE,
			{ fileIds: ["a.zip"] },
			() => ["part.stl"],
			{ workflows: {} },
		);

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.processed[0].error).toContain("unknown workflow");
	});

	test("rt.sub propagates a child failure to the parent", () => {
		const STRICT = `
rt.workflow = function (params) {
  var child = rt.sub("unpack", "workflows/wf-file-unpack.js", { fileId: params.fileId });
  return { entries: child.entries };
};
`;
		const outcome = runWorkflow(
			STRICT,
			{ fileId: "bad.zip" },
			() => {
				throw new Error("corrupt archive");
			},
			{ workflows: { "workflows/wf-file-unpack.js": UNPACK } },
		);

		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.error).toContain("corrupt archive");
	});
});
