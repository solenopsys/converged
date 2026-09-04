// The node cache exists to spare a replay the cost of re-calling microservices.
// rp-dag holds the durable record, so a finished run must not leave its nodes
// behind in Valkey.

import { describe, expect, test } from "bun:test";
import { runWorkflow } from "./centimanus-mock";

const LOOP = `
rt.workflow = function (params) {
  var out = [];
  for (var i = 0; i < params.n; i++) {
    out.push(rt.node("n" + i, function () { return rt.call("svc", "op", {}); }));
  }
  return { count: out.length };
};
`;

const CHILD = `
rt.workflow = function (params) {
  return rt.node("work", function () { return rt.call("svc", "op", params); });
};
`;

const PARENT = `
rt.workflow = function (params) {
  var out = [];
  for (var i = 0; i < params.n; i++) {
    out.push(rt.sub("c" + i, "workflows/child.js", { i: i }));
  }
  return { count: out.length };
};
`;

const taskKeys = (cache: Map<string, string>) =>
	[...cache.keys()].filter((key) => key.startsWith("rt:task:"));

describe("run node cache", () => {
	test("a finished run leaves no node keys behind", () => {
		const cache = new Map<string, string>();
		const outcome = runWorkflow(LOOP, { n: 12 }, () => 1, { cache });

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.count).toBe(12);
		expect(taskKeys(cache)).toEqual([]);
	});

	test("a failed run cleans up too", () => {
		const cache = new Map<string, string>();
		const outcome = runWorkflow(
			LOOP,
			{ n: 5 },
			() => {
				throw new Error("service down");
			},
			{ cache },
		);

		expect(outcome.ok).toBe(false);
		expect(taskKeys(cache)).toEqual([]);
	});

	test("delegated children clean up their own nodes and the parent's", () => {
		const cache = new Map<string, string>();
		const outcome = runWorkflow(PARENT, { n: 4 }, () => 1, {
			cache,
			workflows: { "workflows/child.js": CHILD },
		});

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.count).toBe(4);
		// both the parent's rt.sub outcomes and every child's own node
		expect(taskKeys(cache)).toEqual([]);
	});

	test("a child that fails leaves nothing behind, in it or in the parent", () => {
		const cache = new Map<string, string>();
		const outcome = runWorkflow(
			PARENT.replace("rt.sub(", "rt.subAttempt("),
			{ n: 3 },
			() => {
				throw new Error("service down");
			},
			{ cache, workflows: { "workflows/child.js": CHILD } },
		);

		expect(outcome.ok).toBe(true);
		expect(taskKeys(cache)).toEqual([]);
	});

	test("a parent that fails after its children ran cleans up every level", () => {
		const BOOM = `
rt.workflow = function (params) {
  rt.sub("c0", "workflows/child.js", { i: 0 });
  rt.node("boom", function () { throw new Error("parent gave up"); });
  return { unreachable: true };
};
`;
		const cache = new Map<string, string>();
		const outcome = runWorkflow(BOOM, { n: 1 }, () => 1, {
			cache,
			workflows: { "workflows/child.js": CHILD },
		});

		expect(outcome.ok).toBe(false);
		expect(taskKeys(cache)).toEqual([]);
	});

	test("a grandchild cleans up too", () => {
		const GRANDCHILD = CHILD;
		const MIDDLE = `
rt.workflow = function (params) {
  return rt.sub("leaf", "workflows/grandchild.js", params);
};
`;
		const TOP = `
rt.workflow = function () {
  return { got: rt.sub("mid", "workflows/middle.js", { i: 1 }) };
};
`;
		const cache = new Map<string, string>();
		const outcome = runWorkflow(TOP, {}, () => 42, {
			cache,
			workflows: {
				"workflows/middle.js": MIDDLE,
				"workflows/grandchild.js": GRANDCHILD,
			},
		});

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.got).toBe(42);
		expect(taskKeys(cache)).toEqual([]);
	});

	test("runaway delegation is stopped and still cleans up", () => {
		const SELF = `
rt.workflow = function () {
  return rt.sub("again", "workflows/self.js", {});
};
`;
		const cache = new Map<string, string>();
		const outcome = runWorkflow(SELF, {}, () => 1, {
			cache,
			workflows: { "workflows/self.js": SELF },
		});

		expect(outcome.ok).toBe(false);
		expect(taskKeys(cache)).toEqual([]);
	});

	test("workflow state outside the node cache is left alone", () => {
		const KEEPS = `
rt.workflow = function () {
  rt.node("write", function () { rt.set("app:my-var", { keep: true }); return 1; });
  return { done: true };
};
`;
		const cache = new Map<string, string>();
		const outcome = runWorkflow(KEEPS, {}, () => 1, { cache });

		expect(outcome.ok).toBe(true);
		expect(taskKeys(cache)).toEqual([]);
		// only rt:task: keys are the run's own bookkeeping
		expect(cache.get("app:my-var")).toBe('{"keep":true}');
	});
});
