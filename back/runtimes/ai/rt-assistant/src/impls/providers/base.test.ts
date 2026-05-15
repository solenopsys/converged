import { describe, test, expect } from "bun:test";
import { blocksToMessages } from "./base";
import { ContentType } from "../../types";

describe("blocksToMessages", () => {
  test("string data → user message", () => {
    const result = blocksToMessages([{ type: ContentType.TEXT, data: "hello" }]);
    expect(result).toEqual([{ role: "user", content: "hello" }]);
  });

  test("object with role:user → user message", () => {
    const result = blocksToMessages([{ type: ContentType.TEXT, data: { role: "user", content: "hi" } }]);
    expect(result).toEqual([{ role: "user", content: "hi" }]);
  });

  test("object with role:system → system message", () => {
    const result = blocksToMessages([{ type: ContentType.TEXT, data: { role: "system", content: "You are helpful" } }]);
    expect(result).toEqual([{ role: "system", content: "You are helpful" }]);
  });

  test("object with role:assistant → assistant message", () => {
    const result = blocksToMessages([{ type: ContentType.TEXT, data: { role: "assistant", content: "Sure!" } }]);
    expect(result).toEqual([{ role: "assistant", content: "Sure!" }]);
  });

  test("assistant with tool_calls → assistant message with toolCalls", () => {
    const result = blocksToMessages([{
      type: ContentType.TEXT,
      data: {
        role: "assistant",
        content: "Let me check",
        tool_calls: [{ id: "tc1", function: { name: "get_data", arguments: '{"id":1}' } }],
      },
    }]);
    expect(result).toEqual([{
      role: "assistant",
      content: "Let me check",
      toolCalls: [{ id: "tc1", name: "get_data", args: { id: 1 } }],
    }]);
  });

  test("tool_result block → tool message", () => {
    const result = blocksToMessages([{
      type: ContentType.TOOL_RESULT,
      data: { tool_call_id: "tc1", name: "get_data", data: "result text" },
    }]);
    expect(result).toEqual([{ role: "tool", toolCallId: "tc1", name: "get_data", content: "result text" }]);
  });

  test("tool_result with object data → serialized content", () => {
    const result = blocksToMessages([{
      type: ContentType.TOOL_RESULT,
      data: { tool_call_id: "tc1", name: "fn", data: { value: 42 } },
    }]);
    expect(result[0]).toMatchObject({ role: "tool", toolCallId: "tc1", content: '{"value":42}' });
  });

  test("multiple blocks → multiple messages in order", () => {
    const result = blocksToMessages([
      { type: ContentType.TEXT, data: { role: "system", content: "sys" } },
      { type: ContentType.TEXT, data: "user msg" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("system");
    expect(result[1].role).toBe("user");
  });
});
