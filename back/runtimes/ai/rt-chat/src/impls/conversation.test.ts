import { describe, test, expect } from "bun:test";
import { Conversation } from "./conversation";
import type { ChatLLMProvider, ChatMessage, ProviderStreamEvent } from "./providers/base";
import { StreamEventType, ContentType } from "../types";

function makeProvider(events: ProviderStreamEvent[]): ChatLLMProvider {
  return {
    async *stream(): AsyncGenerator<ProviderStreamEvent> {
      for (const e of events) yield e;
    },
  };
}

async function collect(iter: AsyncIterable<any>): Promise<any[]> {
  const results = [];
  for await (const item of iter) results.push(item);
  return results;
}

describe("Conversation", () => {
  test("yields TEXT_DELTA and COMPLETED", async () => {
    const provider = makeProvider([
      { type: "text_delta", content: "Hello" },
      { type: "text_delta", content: " world" },
      { type: "message_complete", finishReason: "end_turn", usage: { input: 10, output: 5 } },
    ]);

    const conv = new Conversation(provider, "model");
    const events = await collect(conv.send([{ type: ContentType.TEXT, data: "hi" }]));

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: StreamEventType.TEXT_DELTA, content: "Hello", tokens: 0 });
    expect(events[1]).toEqual({ type: StreamEventType.TEXT_DELTA, content: " world", tokens: 0 });
    expect(events[2]).toMatchObject({ type: StreamEventType.COMPLETED, finishReason: "end_turn", tokens: 15 });
  });

  test("yields TOOL_CALL event on tool_call_end", async () => {
    const provider = makeProvider([
      { type: "tool_call_start", id: "tc1", name: "get_data" },
      { type: "tool_call_end", id: "tc1", name: "get_data", args: { id: 1 } },
      { type: "message_complete", finishReason: "tool_use", usage: { input: 5, output: 3 } },
    ]);

    const conv = new Conversation(provider, "model");
    const events = await collect(conv.send([{ type: ContentType.TEXT, data: "call it" }]));

    const toolEvent = events.find(e => e.type === StreamEventType.TOOL_CALL);
    expect(toolEvent).toMatchObject({ type: StreamEventType.TOOL_CALL, id: "tc1", name: "get_data", args: { id: 1 } });
  });

  test("stops on ERROR event", async () => {
    const provider = makeProvider([
      { type: "text_delta", content: "partial" },
      { type: "error", message: "overloaded" },
      { type: "text_delta", content: "never" },
    ]);

    const conv = new Conversation(provider, "model");
    const events = await collect(conv.send([{ type: ContentType.TEXT, data: "hi" }]));

    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ type: StreamEventType.ERROR, message: "overloaded", tokens: 0 });
  });

  test("saves assistant message to history between turns", async () => {
    let capturedMessages: ChatMessage[] = [];
    const provider: ChatLLMProvider = {
      async *stream(messages): AsyncGenerator<ProviderStreamEvent> {
        capturedMessages = [...messages];
        yield { type: "text_delta", content: "reply" };
        yield { type: "message_complete", finishReason: "end_turn", usage: { input: 1, output: 1 } };
      },
    };

    const conv = new Conversation(provider, "model");
    await collect(conv.send([{ type: ContentType.TEXT, data: "first" }]));
    await collect(conv.send([{ type: ContentType.TEXT, data: "second" }]));

    const assistantMsg = capturedMessages.find(m => m.role === "assistant");
    expect(assistantMsg).toMatchObject({ role: "assistant", content: "reply" });
  });

  test("catches thrown errors and yields ERROR", async () => {
    const provider: ChatLLMProvider = {
      async *stream(): AsyncGenerator<ProviderStreamEvent> {
        throw new Error("network failure");
      },
    };

    const conv = new Conversation(provider, "model");
    const events = await collect(conv.send([{ type: ContentType.TEXT, data: "hi" }]));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: StreamEventType.ERROR, message: "network failure", tokens: 0 });
  });

  test("accumulates multiple tool calls before COMPLETED", async () => {
    const provider = makeProvider([
      { type: "tool_call_end", id: "a", name: "fn_a", args: { x: 1 } },
      { type: "tool_call_end", id: "b", name: "fn_b", args: { y: 2 } },
      { type: "message_complete", finishReason: "tool_use", usage: { input: 0, output: 0 } },
    ]);

    const conv = new Conversation(provider, "model");
    const events = await collect(conv.send([{ type: ContentType.TEXT, data: "run" }]));

    const toolEvents = events.filter(e => e.type === StreamEventType.TOOL_CALL);
    expect(toolEvents).toHaveLength(2);
    expect(toolEvents[0].name).toBe("fn_a");
    expect(toolEvents[1].name).toBe("fn_b");
  });
});
