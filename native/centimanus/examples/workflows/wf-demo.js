// Minimal smoke workflow for the step-driven DAG. Every side-effecting call is
// wrapped in a node, so the engine runs exactly one per evaluation and breaks
// (yields) between them; step-a is called twice but executes once (memoised).
rt.workflow = function (params) {
  var a = rt.node("step-a", function () { return { n: params.n * 2 }; });
  var b = rt.node("step-a", function () { return { n: 999 }; }); // memoised -> equals a
  var ping = rt.node("ping", function () { return rt.call("demo", "ping", { x: params.n }); });
  rt.set("rt:var:demo", { saved: true });
  return {
    doubled: a.n,
    memoised_equal: a.n === b.n,
    got: rt.get("rt:var:demo"),
    ping: ping,
  };
};
