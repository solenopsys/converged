import type { ContentBlock, ConversationOptions } from "../../types";
import { ContentType } from "../../types";

export type ProviderStreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call_delta"; id: string; argsJson: string }
  | { type: "tool_call_end"; id: string; name: string; args: Record<string, unknown> }
  | { type: "message_complete"; finishReason: string; usage: { input: number; output: number } }
  | { type: "error"; message: string };

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "system"; content: string }
  | { role: "assistant"; content: string; toolCalls?: { id: string; name: string; args: Record<string, unknown> }[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface ChatLLMProvider {
  stream(messages: ChatMessage[], model: string, options?: ConversationOptions): AsyncGenerator<ProviderStreamEvent>;
}

export function blocksToMessages(blocks: ContentBlock[]): ChatMessage[] {
  return blocks.map((block): ChatMessage => {
    if (block.type === ContentType.TOOL_RESULT) {
      const d = block.data as any;
      return {
        role: "tool",
        toolCallId: d.tool_call_id ?? (block as any).tool_call_id ?? "",
        name: d.name ?? "",
        content: typeof d.data === "string" ? d.data : JSON.stringify(d.data ?? d),
      };
    }

    if (typeof block.data === "string") {
      return { role: "user", content: block.data };
    }

    const d = block.data as any;
    const role = d.role === "assistant" ? "assistant" as const
               : d.role === "system"    ? "system" as const
               : "user" as const;

    if (role === "assistant" && d.tool_calls?.length) {
      return {
        role: "assistant",
        content: d.content ?? "",
        toolCalls: d.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name ?? tc.name ?? "",
          args: typeof tc.function?.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments ?? tc.args ?? {},
        })),
      };
    }

    return { role, content: d.content ?? "" };
  });
}
