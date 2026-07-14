import { describe, expect, test } from "bun:test";
import { runOk, runWorkflow } from "./centimanus-mock";

// A compiled workflow (what bun would emit from a TS workflow). Flow only:
// nodes call microservices; the harness answers those calls.
const OUTREACH = `
rt.workflow = function (params) {
  var lead = rt.node("find-lead", function () {
    return rt.call("sales", "findLead", { lang: params.lang });
  });
  if (!lead) return { skipped: true };
  var draft = rt.node("build-draft", function () {
    return { to: lead.email, subject: "Hi " + lead.name };
  });
  rt.node("send", function () { return rt.call("smtp", "send", draft); });
  rt.node("record", function () { return rt.call("sales", "recordTouch", { lead: lead.id }); });
  return { sentTo: lead.email, subject: draft.subject };
};
`;

// Data passed by reference through the cache: materialize stashes a blob and
// returns a CacheRef; convert reads it back by ref. The services never share
// data directly — only the cache does.
const PIPELINE = `
rt.workflow = function (params) {
  var staged = rt.node("stage", function () {
    return rt.call("files", "materialize", { fileId: params.fileId });
  });
  var out = rt.node("convert", function () {
    return rt.call("convertor", "convert", { sourceRef: staged.ref });
  });
  return { sourceRef: staged.ref, outRef: out.ref };
};
`;

describe("RT VM (mock transport)", () => {
	test("runs a workflow end-to-end against TS handlers", () => {
		const calls: string[] = [];
		const result = runOk(OUTREACH, { lang: "ru" }, (service, method, params) => {
			calls.push(`${service}.${method}`);
			if (service === "sales" && method === "findLead") {
				expect(params.lang).toBe("ru");
				return { id: 7, email: "alex@club.ru", name: "Alex" };
			}
			if (service === "smtp" && method === "send") {
				expect(params).toEqual({ to: "alex@club.ru", subject: "Hi Alex" });
				return { id: "msg-1" };
			}
			if (service === "sales" && method === "recordTouch") return null;
			throw new Error(`unexpected ${service}.${method}`);
		});

		expect(result).toEqual({ sentTo: "alex@club.ru", subject: "Hi Alex" });
		// One node per step, each microservice call made exactly once, in order.
		expect(calls).toEqual(["sales.findLead", "smtp.send", "sales.recordTouch"]);
	});

	test("passes heavy data by reference through the cache", () => {
		const result = runWorkflow(PIPELINE, { fileId: "model-1" }, (service, method, params, cache) => {
			if (service === "files" && method === "materialize") {
				const key = `blob:${params.fileId}`;
				cache.set(key, JSON.stringify({ name: `${params.fileId}.stl`, bytes: "<stl>" }));
				return { ref: { cacheKey: key } };
			}
			if (service === "convertor" && method === "convert") {
				const blob = JSON.parse(cache.get(params.sourceRef.cacheKey)!); // read by reference
				const outKey = "blob:out";
				cache.set(outKey, JSON.stringify({ name: `${blob.name}.glb` }));
				return { ref: { cacheKey: outKey } };
			}
			throw new Error(`unexpected ${service}.${method}`);
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.result.outRef).toEqual({ cacheKey: "blob:out" });
		// The cache (Valkey stand-in) holds both blobs the services exchanged.
		expect(JSON.parse(result.cache.get("blob:model-1")!).name).toBe("model-1.stl");
		expect(JSON.parse(result.cache.get("blob:out")!).name).toBe("model-1.stl.glb");
	});

	test("a branch that skips the send", () => {
		const calls: string[] = [];
		const result = runOk(OUTREACH, { lang: "de" }, (service, method) => {
			calls.push(`${service}.${method}`);
			return null; // no lead found
		});
		expect(result).toEqual({ skipped: true });
		expect(calls).toEqual(["sales.findLead"]); // branch took the early return
	});

	test("a handler failure surfaces as a failed workflow", () => {
		const outcome = runWorkflow(OUTREACH, { lang: "ru" }, (service) => {
			if (service === "sales") return { id: 1, email: "x@y.z", name: "X" };
			throw new Error("smtp down");
		});
		expect(outcome.ok).toBe(false);
	});
});
