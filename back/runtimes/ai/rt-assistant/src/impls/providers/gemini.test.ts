import { describe, test, expect } from "bun:test";
import { GeminiProvider } from "./gemini";

async function* fakeStream(chunks: any[]) {
  for (const c of chunks) yield c;
}

function makeClient(chunks: any[]) {
  return { models: { generateContentStream: async () => fakeStream(chunks) } } as any;
}

async function collect(gen: AsyncGenerator<any>): Promise<any[]> {
  const results = [];
  for await (const e of gen) results.push(e);
  return results;
}

const messages = [{ role: "user" as const, content: "hi" }];

describe("GeminiProvider", () => {
  test("yields text_delta from text parts", async () => {
    const client = makeClient([
      { candidates: [{ content: { parts: [{ text: "Hello" }] }, finishReason: null }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } },
      { candidates: [{ content: { parts: [] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } },
    ]);
    const events = await collect(new GeminiProvider(client).stream(messages, "gemini-2.0"));
    expect(events).toContainEqual({ type: "text_delta", content: "Hello" });
    expect(events).toContainEqual({ type: "message_complete", finishReason: "STOP", usage: { input: 3, output: 2 } });
  });

  test("yields tool_call_start and tool_call_end for functionCall parts", async () => {
    const client = makeClient([
      {
        candidates: [{
          content: { parts: [{ functionCall: { id: "fc1", name: "get_data", args: { id: 5 } } }] },
          finishReason: "STOP",
        }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
      },
    ]);
    const events = await collect(new GeminiProvider(client).stream(messages, "gemini-2.0"));
    expect(events).toContainEqual({ type: "tool_call_start", id: "fc1", name: "get_data" });
    expect(events).toContainEqual({ type: "tool_call_end", id: "fc1", name: "get_data", args: { id: 5 } });
    expect(events).toContainEqual({ type: "message_complete", finishReason: "STOP", usage: { input: 5, output: 3 } });
  });

  test("emits message_complete when finishReason appears on chunk with content", async () => {
    const client = makeClient([
      {
        candidates: [{ content: { parts: [{ text: "done" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      },
    ]);
    const events = await collect(new GeminiProvider(client).stream(messages, "gemini-2.0"));
    const completeEvents = events.filter(e => e.type === "message_complete");
    expect(completeEvents).toHaveLength(1);
  });

  test("ignores FINISH_REASON_UNSPECIFIED", async () => {
    const client = makeClient([
      { candidates: [{ content: { parts: [{ text: "partial" }] }, finishReason: "FINISH_REASON_UNSPECIFIED" }], usageMetadata: {} },
      { candidates: [{ content: { parts: [] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1 } },
    ]);
    const events = await collect(new GeminiProvider(client).stream(messages, "gemini-2.0"));
    const completeEvents = events.filter(e => e.type === "message_complete");
    expect(completeEvents).toHaveLength(1);
  });
});
