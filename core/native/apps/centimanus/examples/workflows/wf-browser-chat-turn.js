// Kept beside the native examples for container/unit smoke runs. The deployed
// copy is owned by the scripts microservice under back/workflows.
rt.workflow = function (params) {
  var historyKey = "chat:history:" + params.sessionId;
  var history = rt.get(historyKey) || [];
  var blocks = params.messages || [];
  var context = rt.node("load-context", function () {
    if (!params.contextName) return null;
    return rt.call("contexts", "getContext", { name: params.contextName, language: params.language });
  });
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i] || {};
    if (block.type === "text") history.push({ role: "user", content: String(block.data || "") });
    if (block.type === "tool_result") history.push({
      role: "tool",
      toolCallId: block.toolCallId || block.tool_call_id || "",
      content: typeof block.data === "string" ? block.data : JSON.stringify(block.data),
    });
  }
  var completion = rt.node("llm-turn", function () {
    return rt.llm({
      provider: params.provider,
      model: params.model,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      messages: [{ role: "system", content: (context && context.data) || "" }].concat(history),
      tools: params.tools || [],
    });
  });
  history.push({ role: "assistant", content: completion.text || "", toolCalls: completion.toolCalls || [] });
  rt.set(historyKey, history);
  return completion;
};
