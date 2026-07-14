// rt prelude — the flow surface for a *step-driven* DAG.
//
// The engine does NOT run a workflow as one long process. It runs the script in
// short steps: each evaluation replays the already-finished nodes (reading their
// results from Valkey), executes exactly ONE not-yet-done node, persists it, and
// YIELDS. The engine then re-enters; the context has changed, so the next node
// runs. One node per evaluation — atomic, resumable, with a clean break between
// nodes and no long-lived JS process waiting on anything.
//
// The engine evaluates: <this prelude> + <workflow source> + ";__step();" after
// injecting globalThis.__execId and globalThis.__params.

(function () {
  function host(payload) {
    var raw = __host(JSON.stringify(payload));
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("rt: malformed host reply: " + raw);
    }
  }

  var execId = globalThis.__execId;

  // Sentinel thrown to unwind out to the engine after one node runs. It is a
  // bare object, never an Error, and the workflow never wraps node calls in
  // try/catch (node failures come back as values via rt.attempt), so it always
  // reaches __step uncaught.
  var YIELD = { __rtYield: true };

  function taskKey(name) {
    return "rt:task:" + execId + ":" + name;
  }

  // Run a node's body once, persist the outcome, and yield. On replay (the
  // outcome is already in Valkey) no work happens — we just hand the stored
  // value/error straight back.
  function runOrReplay(name, fn) {
    var cached = rt.get(taskKey(name));
    if (cached) return cached; // { ok:true, value } | { ok:false, error }

    var outcome;
    try {
      var value = fn();
      outcome = { ok: true, value: value === undefined ? null : value };
    } catch (e) {
      outcome = { ok: false, error: String((e && e.message) || e) };
    }
    rt.set(taskKey(name), outcome);
    throw YIELD; // one node per step — the engine re-enters for the next
  }

  var rt = {
    // ---- dumb host primitives ----------------------------------------------
    call: function (service, method, params) {
      var res = host({ op: "call", service: service, method: method, body: JSON.stringify(params || {}) });
      if (!res.ok) {
        throw new Error((res.body && res.body.error) || ("HTTP " + res.status + " " + service + "/" + method));
      }
      return res.body;
    },
    get: function (key) {
      var res = host({ op: "get", key: key });
      if (!res.ok) throw new Error(res.error || "rt.get failed");
      return res.value;
    },
    set: function (key, value) {
      var res = host({ op: "set", key: key, json: JSON.stringify(value === undefined ? null : value) });
      if (!res.ok) throw new Error(res.error || "rt.set failed");
    },
    log: function (message) {
      host({ op: "log", message: String(message) });
    },

    // ---- llm (uniform chat completion via the Zig provider hub) -------------
    // rt.llm({ provider, model, maxTokens, messages, tools?, temperature? })
    //   -> { provider, model, text, toolCalls: [{id,name,args}], finishReason,
    //        usage: {input, output} }
    // Everything is explicit — no default provider, model or token budget.
    // Wrap calls in rt.node(...) so a completed round is never re-paid.
    llm: function (params) {
      var res = host({ op: "llm", json: JSON.stringify(params || {}) });
      if (!res.ok) throw new Error(res.error || "rt.llm failed");
      return res.value;
    },

    // ---- the DAG node ------------------------------------------------------
    // Strict: returns the value, or throws on a recorded failure (fails the run).
    node: function (name, fn) {
      var outcome = runOrReplay(name, fn);
      if (outcome.ok) return outcome.value;
      throw new Error(outcome.error);
    },
    // Lenient: never throws to the caller — returns { ok, value } | { ok, error },
    // so a workflow can record the error and carry on. (Still one node per step.)
    attempt: function (name, fn) {
      return runOrReplay(name, fn);
    },
  };

  globalThis.rt = rt;

  // One engine step: replay to the current frontier, run one node (which yields),
  // or — if every node is already done — finish and return the result.
  globalThis.__step = function () {
    var entry =
      (typeof rt.workflow === "function" && rt.workflow) ||
      (typeof workflow === "function" && workflow);
    if (typeof entry !== "function") {
      return JSON.stringify({ status: "failed", error: "rt: workflow defines no entrypoint" });
    }
    try {
      var out = entry(globalThis.__params);
      return JSON.stringify({ status: "done", result: out === undefined ? null : out });
    } catch (e) {
      if (e === YIELD) return JSON.stringify({ status: "yielded" });
      return JSON.stringify({ status: "failed", error: String((e && e.message) || e) });
    }
  };
})();
