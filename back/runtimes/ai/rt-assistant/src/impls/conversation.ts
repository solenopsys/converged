import { randomUUID } from "crypto";
import type { ContentBlock, StreamEvent, ConversationOptions } from "../types";
import { StreamEventType } from "../types";
import type { ChatLLMProvider, ChatMessage } from "./providers/base";
import { blocksToMessages } from "./providers/base";

export class Conversation {
  private readonly id = randomUUID();
  private history: ChatMessage[];

  constructor(
    private readonly provider: ChatLLMProvider,
    private readonly model: string,
    systemPrompt?: string,
  ) {
    this.history = systemPrompt ? [{ role: "system", content: systemPrompt }] : [];
  }

  getId(): string {
    return this.id;
  }

  async *send(blocks: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent> {
    this.history.push(...blocksToMessages(blocks));

    let assistantText = "";
    const toolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];

    try {
      for await (const event of this.provider.stream(this.history, this.model, options)) {
        switch (event.type) {
          case "text_delta":
            assistantText += event.content;
            yield { type: StreamEventType.TEXT_DELTA, content: event.content, tokens: 0 };
            break;

          case "tool_call_end":
            toolCalls.push({ id: event.id, name: event.name, args: event.args });
            yield { type: StreamEventType.TOOL_CALL, id: event.id, name: event.name, args: event.args, tokens: 0 };
            break;

          case "message_complete":
            this.history.push({
              role: "assistant",
              content: assistantText,
              ...(toolCalls.length ? { toolCalls: [...toolCalls] } : {}),
            });
            yield { type: StreamEventType.COMPLETED, finishReason: event.finishReason, tokens: event.usage.input + event.usage.output };
            return;

          case "error":
            yield { type: StreamEventType.ERROR, message: event.message, tokens: 0 };
            return;
        }
      }
    } catch (e: any) {
      yield { type: StreamEventType.ERROR, message: e?.message ?? "Stream failed", tokens: 0 };
    }
  }
}
