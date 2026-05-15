import { describe, test, expect } from "bun:test";
import { ClaudeProvider } from "./claude";

async function* fakeStream(events: any[]) {
  for (const e of events) yield e;
}

function makeClient(events: any[]) {
  return { messages: { create: async () => fakeStream(events) } } as any;
}

async function collect(gen: AsyncGenerator<any>): Promise<any[]> {
  const results = [];
  for await (const e of gen) results.push(e);
  return results;
}

const messages = [{ role: "user" as const, content: "hi" }];

describe("ClaudeProvider", () => {
  test("yields text_delta from content_block_delta", async () => {
    const client = makeClient([
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { input_tokens: 5, output_tokens: 3 } },
    ]);
    const events = await collect(new ClaudeProvider(client).stream(messages, "claude-3"));
    expect(events).toContainEqual({ type: "text_delta", content: "Hello" });
    expect(events).toContainEqual({ type: "message_complete", finishReason: "end_turn", usage: { input: 5, output: 3 } });
  });

  test("yields text from content_block_start with initial text", async () => {
    const client = makeClient([
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "Hi!" } },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { input_tokens: 1, output_tokens: 1 } },
    ]);
    const events = await collect(new ClaudeProvider(client).stream(messages, "claude-3"));
    expect(events[0]).toEqual({ type: "text_delta", content: "Hi!" });
  });

  test("assembles tool call from start/delta/stop", async () => {
    const client = makeClient([
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tc1", name: "get_data" } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"id"' } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: ':1}' } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { input_tokens: 10, output_tokens: 5 } },
    ]);
    const events = await collect(new ClaudeProvider(client).stream(messages, "claude-3"));

    expect(events).toContainEqual({ type: "tool_call_start", id: "tc1", name: "get_data" });
    expect(events).toContainEqual({ type: "tool_call_end", id: "tc1", name: "get_data", args: { id: 1 } });
    const deltas = events.filter(e => e.type === "tool_call_delta");
    expect(deltas).toHaveLength(2);
  });

  test("yields error event on error type", async () => {
    const client = makeClient([
      { type: "error", error: { message: "overloaded" } },
    ]);
    const events = await collect(new ClaudeProvider(client).stream(messages, "claude-3"));
    expect(events).toContainEqual({ type: "error", message: "overloaded" });
  });

  test("handles parallel tool calls at different indexes", async () => {
    const client = makeClient([
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "a", name: "fn_a" } },
      { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "b", name: "fn_b" } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{}' } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{}' } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_stop", index: 1 },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { input_tokens: 0, output_tokens: 0 } },
    ]);
    const events = await collect(new ClaudeProvider(client).stream(messages, "claude-3"));
    const ends = events.filter(e => e.type === "tool_call_end");
    expect(ends).toHaveLength(2);
    expect(ends.map((e: any) => e.id).sort()).toEqual(["a", "b"]);
  });
});
