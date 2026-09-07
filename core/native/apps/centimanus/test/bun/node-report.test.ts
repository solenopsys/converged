// What the engine hands to rp-dag for every executed node. Before this the
// record was two nulls: no result, no input, no start time.
import { describe, expect, test } from "bun:test";
import { runWorkflow } from "./centimanus-mock";

const WF = `
rt.workflow = function (params) {
  var lead = rt.node("make-lead", function () {
    return { id: "l-" + params.n, name: "Acme" };
  });
  var saved = rt.node("save-lead:" + lead.id, function () {
    return rt.call("sales", "addLead", { lead: lead });
  });
  var missing = rt.attempt("tag:" + lead.id, function () {
    return rt.call("sales", "assignLeadTag", { leadId: lead.id, tag: "cnc" });
  });
  return { saved: saved, tagged: missing.ok };
};
`;

const handler = (service: string, method: string) => {
	if (method === "assignLeadTag") throw new Error("tags are down");
	return { id: "saved" };
};

describe("per-node reporting", () => {
	test("a node reports its result, the calls it made and its timing", () => {
		const outcome = runWorkflow(WF, { n: 1 }, handler);
		expect(outcome.ok).toBe(true);

		const save = outcome.nodes.find((node) => node.node === "save-lead:l-1");
		expect(save).toBeDefined();
		expect(save!.ok).toBe(true);
		// the outcome, not null
		expect(save!.result).toEqual({ ok: true, value: { id: "saved" } });
		// the input: what this node asked of the microservices
		expect(save!.input).toEqual([
			{ service: "sales", method: "addLead", params: { lead: { id: "l-1", name: "Acme" } } },
		]);
		expect(save!.startedMs).toBeGreaterThan(0);
		expect(save!.completedMs).toBeGreaterThan(save!.startedMs);
	});

	test("calls are attributed to the node that made them, not to a later one", () => {
		const outcome = runWorkflow(WF, { n: 2 }, handler);

		const make = outcome.nodes.find((node) => node.node === "make-lead");
		expect(make!.input).toEqual([]);
		expect(make!.result).toEqual({ ok: true, value: { id: "l-2", name: "Acme" } });
	});

	test("a failed attempt still reports its input and its error", () => {
		const outcome = runWorkflow(WF, { n: 3 }, handler);
		expect(outcome.ok).toBe(true);

		const tag = outcome.nodes.find((node) => node.node === "tag:l-3");
		expect(tag!.ok).toBe(false);
		expect(tag!.error).toContain("tags are down");
		expect(tag!.input).toEqual([
			{ service: "sales", method: "assignLeadTag", params: { leadId: "l-3", tag: "cnc" } },
		]);
	});

	test("every executed node is reported exactly once", () => {
		const outcome = runWorkflow(WF, { n: 4 }, handler);
		expect(outcome.nodes.map((node) => node.node)).toEqual([
			"make-lead",
			"save-lead:l-4",
			"tag:l-4",
		]);
	});
});
