// A node that waits on a slow microservice, on the real VM.
// Build the library first: cd ../.. && zig build mock -Dtarget=x86_64-linux-gnu
//
// The engine caps how long one step may run, and the cap exists to catch a
// workflow that loops forever. A node's own work, though, happens in a
// microservice: the script blocks inside `__host` while the service unpacks an
// archive or slices a model, and that wait is not the script's compute. When it
// was charged to the same budget, unpacking a 7 MB archive died with
// `InternalError: interrupted` — the workflow never spun a cycle of its own.

import { describe, expect, test } from "bun:test";
import { runWorkflow } from "./centimanus-mock";

const UNPACK = `
rt.workflow = function (params) {
  var entries = rt.node("unzip", function () {
    return rt.call("compressors", "unpack", { fileId: params.fileId });
  });
  return { fileId: params.fileId, entries: entries };
};
`;

// A parent that delegates: the child's slow node runs inside the parent's step,
// so a budget that counted service time would kill both.
const INTAKE = `
rt.workflow = function (params) {
  var child = rt.subAttempt("unpack", "workflows/wf-file-unpack.js", { fileId: params.fileId });
  if (!child.ok) return { error: child.error };
  return { entries: child.value.entries };
};
`;

/** Block the calling thread the way a synchronous service call does. */
function stall(ms: number): void {
	const until = Date.now() + ms;
	while (Date.now() < until) {
		// spin: the handler is called synchronously from the VM
	}
}

describe("a slow microservice", () => {
	test("does not spend the step budget", () => {
		const outcome = runWorkflow(UNPACK, { fileId: "big.zip" }, () => {
			stall(400);
			return ["part.stl", "notes.txt"];
		});

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.entries).toEqual(["part.stl", "notes.txt"]);
	});

	test("does not spend it through a delegation either", () => {
		const outcome = runWorkflow(
			INTAKE,
			{ fileId: "big.zip" },
			() => {
				stall(400);
				return ["part.stl"];
			},
			{ workflows: { "workflows/wf-file-unpack.js": UNPACK } },
		);

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.entries).toEqual(["part.stl"]);
	});

	test("several slow nodes in one workflow all complete", () => {
		const source = `
rt.workflow = function (params) {
  var out = [];
  for (var i = 0; i < params.ids.length; i++) {
    var id = params.ids[i];
    out.push(rt.node("chunk:" + id, function () {
      return rt.call("store", "save", { id: id });
    }));
  }
  return { saved: out };
};
`;
		const outcome = runWorkflow(source, { ids: ["a", "b", "c"] }, (_s, _m, params) => {
			stall(150);
			return `hash-${params.id}`;
		});

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.saved).toEqual(["hash-a", "hash-b", "hash-c"]);
	});
});
