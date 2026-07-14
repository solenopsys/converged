// wf-chat-turn — one chat turn as a step-driven agent loop.
//
// Flow only. Session history lives in Valkey (rt.get/set), every LLM round is
// a memoised node (a crash or restart never re-pays tokens already spent),
// tool bodies live in microservices and are reached with rt.call. Provider,
// model and token budget are explicit parameters — the VM invents nothing.
//
// params: { sessionId, text, provider, model, maxTokens, system,
//           tools?: [{name,description,parameters}], toolsService? }

rt.workflow = function (params) {
  var histKey = "chat:hist:" + params.sessionId;
  var history = rt.get(histKey) || [];
  history.push({ role: "user", content: params.text });

  var tools = params.tools || [];
  var reply = "";
  var round = 0;

  for (;;) {
    var res = rt.node("llm-round-" + round, function () {
      return rt.llm({
        provider: params.provider,
        model: params.model,
        maxTokens: params.maxTokens,
        messages: [{ role: "system", content: params.system }].concat(history),
        tools: tools,
      });
    });

    history.push({ role: "assistant", content: res.text, toolCalls: res.toolCalls });

    if (!res.toolCalls || res.toolCalls.length === 0) {
      reply = res.text;
      break;
    }

    // Tool bodies are microservice methods; each call is its own memoised node.
    for (var i = 0; i < res.toolCalls.length; i++) {
      (function (tc, nodeName) {
        var out = rt.node(nodeName, function () {
          return rt.call(params.toolsService, tc.name, tc.args);
        });
        history.push({
          role: "tool",
          toolCallId: tc.id,
          name: tc.name,
          content: JSON.stringify(out === undefined ? null : out),
        });
      })(res.toolCalls[i], "tool-" + round + "-" + i + "-" + res.toolCalls[i].name);
    }

    round++;
  }

  rt.set(histKey, history);
  return { reply: reply, rounds: round + 1 };
};
