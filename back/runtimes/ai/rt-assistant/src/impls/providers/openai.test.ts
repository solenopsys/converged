import { describe, test, expect } from "bun:test";
import { OpenAIProvider } from "./openai";

async function* fakeStream(chunks: any[]) {
  for (const c of chunks) yield c;
}

function makeClient(chunks: any[]) {
  return { chat: { completions: { create: async () => fakeStream(chunks) } } } as any;
}

async function collect(gen: AsyncGenerator<any>): Promise<any[]> {
  const results = [];
  for await (const e of gen) results.push(e);
  return results;
}

const messages = [{ role: "user" as const, content: "hi" }];

describe("OpenAIProvider", () => {
  test("yields text_delta from delta.content", async () => {
    const client = makeClient([
      { choices: [{ delta: { content: "Hello" }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 3 } },
    ]);
    const events = await collect(new OpenAIProvider(client).stream(messages, "gpt-4o"));
    expect(events).toContainEqual({ type: "text_delta", content: "Hello" });
    expect(events).toContainEqual({ type: "message_complete", finishReason: "stop", usage: { input: 5, output: 3 } });
  });

  test("assembles tool call from incremental tool_calls deltas", async () => {
    const client = makeClient([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "tc1", function: { name: "get_data", arguments: '{"id"' } }] }, finish_reason: null }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':1}' } }] }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 10, completion_tokens: 5 } },
    ]);
    const events = await collect(new OpenAIProvider(client).stream(messages, "gpt-4o"));

    expect(events).toContainEqual({ type: "tool_call_start", id: "tc1", name: "get_data" });
    expect(events).toContainEqual({ type: "tool_call_end", id: "tc1", name: "get_data", args: { id: 1 } });
    expect(events).toContainEqual({ type: "message_complete", finishReason: "tool_calls", usage: { input: 10, output: 5 } });
  });

  test("emits all tool_call_end before message_complete", async () => {
    const client = makeClient([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "a", function: { name: "fn_a", arguments: '{}' } }] }, finish_reason: null }] },
      { choices: [{ delta: { tool_calls: [{ index: 1, id: "b", function: { name: "fn_b", arguments: '{}' } }] }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 0, completion_tokens: 0 } },
    ]);
    const events = await collect(new OpenAIProvider(client).stream(messages, "gpt-4o"));
    const ends = events.filter(e => e.type === "tool_call_end");
    expect(ends).toHaveLength(2);
    const complete = events.findIndex(e => e.type === "message_complete");
    const lastEnd = events.findLastIndex((e: any) => e.type === "tool_call_end");
    expect(lastEnd).toBeLessThan(complete);
  });

  test("no usage in chunks → zeros in message_complete", async () => {
    const client = makeClient([
      { choices: [{ delta: {}, finish_reason: "stop" }] },
    ]);
    const events = await collect(new OpenAIProvider(client).stream(messages, "gpt-4o"));
    expect(events).toContainEqual({ type: "message_complete", finishReason: "stop", usage: { input: 0, output: 0 } });
  });
});
