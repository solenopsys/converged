// rt prelude — the flow surface of a workflow.
//
// The engine loads this file plus the workflow bundle ONCE per execution and
// then calls `__run`. The workflow is an ordinary function: it runs top to
// bottom, `rt.node` executes its body and returns the value, `rt.sub` returns
// what the child workflow returned. Nothing is re-entered, nothing is replayed,
// and no exception is used for control flow.
//
// Everything here is synchronous. A host primitive blocks the script until the
// service answers — that is the entire concurrency model, and it is why a
// workflow reads like a script and not like a promise chain.
//
// A node's outcome is written to the state store before it returns, and read
// back if it is already there. That matters on one occasion only: a re-run of
// the same execution id, after a crash, skips the services that already
// answered instead of calling them twice.

(function () {
  function host(payload) {
    var raw = __host(JSON.stringify(payload));
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("rt: malformed host reply: " + raw);
    }
  }

  // The node cache lives on the host side: it owns the key shape, the cleanup
  // of a finished run and the per-node bookkeeping ms-dag records.
  function cachedOutcome(name) {
    var res = host({ op: "nodeGet", node: String(name) });
    if (!res.ok) throw new Error(res.error || "rt: node cache read failed");
    return res.value; // { ok:true, value } | { ok:false, error } | null
  }

  function keepOutcome(name, outcome) {
    var res = host({ op: "nodeSet", node: String(name), json: JSON.stringify(outcome) });
    if (!res.ok) throw new Error(res.error || "rt: node cache write failed");
  }

  // Run the node's body once and keep what it produced. A failure is recorded
  // as data — the caller decides whether it ends the workflow (rt.node) or is
  // handed back (rt.attempt).
  function runNode(name, fn) {
    var cached = cachedOutcome(name);
    if (cached) return cached;

    var outcome;
    try {
      var value = fn();
      outcome = { ok: true, value: value === undefined ? null : value };
    } catch (e) {
      outcome = { ok: false, error: String((e && e.message) || e) };
    }
    keepOutcome(name, outcome);
    return outcome;
  }

  // Delegate to another workflow. The host runs it on its own runtime and hands
  // back its outcome in the same shape a node has, so a delegation caches and
  // resumes exactly like one.
  function runSub(name, scriptPath, params) {
    var cached = cachedOutcome(name);
    if (cached) return cached;
    if (!scriptPath) throw new Error("rt.sub: scriptPath is required");
    return host({
      op: "sub",
      node: String(name),
      script: String(scriptPath),
      params: params === undefined ? {} : params,
    });
  }

  var rt = {
    // ---- dumb host primitives ----------------------------------------------
    // `target` is the Fujin peer the service answers behind; omitted for a
    // microservice, which lives in the peer the engine already dials. A native
    // peer of its own — a processor container — names itself, and without it
    // the call is routed to `services` and dropped as unroutable.
    call: function (service, method, params, target) {
      var res = host({
        op: "call",
        service: service,
        method: method,
        target: target || "",
        body: JSON.stringify(params || {}),
      });
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
      var outcome = runNode(name, fn);
      if (outcome.ok) return outcome.value;
      throw new Error(outcome.error);
    },
    // Lenient: never throws to the caller — returns { ok, value } | { ok, error },
    // so a workflow can record the error and carry on.
    attempt: function (name, fn) {
      return runNode(name, fn);
    },

    // ---- delegation to another workflow ------------------------------------
    // Strict: returns the child's result, or throws on its failure.
    sub: function (name, scriptPath, params) {
      var outcome = runSub(name, scriptPath, params);
      if (outcome.ok) return outcome.value;
      throw new Error(outcome.error);
    },
    // Lenient: { ok, value } | { ok, error }, so a batch survives one bad child.
    subAttempt: function (name, scriptPath, params) {
      return runSub(name, scriptPath, params);
    },
  };

  globalThis.rt = rt;

  // The entry point the engine calls once. Its result is the run's result.
  globalThis.__run = function () {
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
      return JSON.stringify({ status: "failed", error: String((e && e.message) || e) });
    }
  };
})();
