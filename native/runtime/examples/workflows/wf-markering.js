// wf-markering — translated from club-portal/back/workflows/wf-markering.ts
//
// In the old engine this workflow wired up nine node *classes*, each holding
// logic + a provider.invoke(...). Here every node body has moved into ms-marker
// (see MAPPING.md §1.2): the workflow keeps only the flow — sequence, branches,
// error handling. No business logic, no providers, no node registry.
//
// This file lives in the scripts microservice; the RT VM fetches and runs it.
// `rt` is the only surface: rt.call / rt.get / rt.set / rt.log / rt.node.

rt.workflow = function (params) {
  // 1. next "new" domain
  var found = rt.node("get-new-domain", function () {
    return rt.call("marker", "getDomainByState", { state: "new" });
  });
  if (!found || !found.domain) return { skipped: "no new domain" };
  var domain = found.domain;

  // 2. mark processing
  rt.node("set-processing", function () {
    return rt.call("marker", "setDomainState", { domain: domain, state: "processing" });
  });

  // 3. numbered text doc (doc-assembly logic now inside ms-marker)
  var doc = rt.node("build-text-doc", function () {
    return rt.call("marker", "buildTextDoc", { domain: domain });
  });

  // 4. validate — ms-marker returns a verdict instead of throwing a typed error
  var verdict = rt.node("validate-content", function () {
    return rt.call("marker", "validateContent", { text: doc.text });
  });
  if (!verdict.valid) {
    var state = verdict.reason === "forbidden" ? "forbidden" : "new"; // 503 -> retry as "new"
    rt.node("set-final-state", function () {
      return rt.call("marker", "setDomainState", { domain: domain, state: state });
    });
    return { domain: domain, result: verdict.reason };
  }

  // 5. enabled tags
  var tags = rt.node("get-tags", function () {
    return rt.call("marker", "listTags", {});
  }).tags;

  // 6. classify + tag in one LLM call (LLM lives inside ms-marker)
  var tagged = rt.node("ai-tag", function () {
    return rt.call("marker", "aiTag", { text: doc.text, tags: tags, provider: params.provider });
  });

  // 7. save site class
  rt.node("set-domain-class", function () {
    return rt.call("marker", "setDomainClass", { domain: domain, type: tagged.type });
  });

  // 8. save tags only for valid sites
  if (tagged.type !== "novalid" && tagged.tagged.length > 0) {
    rt.node("set-tags", function () {
      return rt.call("marker", "setTags", {
        tagged: tagged.tagged,
        mapping: doc.mapping,
        lines: doc.text.split("\n"),
      });
    });
  }

  // 9. final state
  rt.node("set-final-state", function () {
    return rt.call("marker", "setDomainState", { domain: domain, state: "tagged" });
  });

  return { domain: domain, type: tagged.type, result: "tagged" };
};
