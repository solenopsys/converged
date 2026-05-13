import Anthropic from "@anthropic-ai/sdk";
import type { ChatLLMProvider, ChatMessage, ProviderStreamEvent } from "./base";
import type { ConversationOptions } from "../../types";

export class ClaudeProvider implements ChatLLMProvider {
  constructor(private readonly client: Anthropic) {}

  async *stream(messages: ChatMessage[], model: string, options?: ConversationOptions): AsyncGenerator<ProviderStreamEvent> {
    const system = messages.find(m => m.role === "system")?.content;
    const req: any = {
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      messages: this.toAnthropicMessages(messages.filter(m => m.role !== "system")),
      stream: true,
    };
    if (system) req.system = system;
    if (options?.tools?.length) {
      req.tools = options.tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    }

    const stream = await this.client.messages.create(req);

    const toolIds   = new Map<number, string>();
    const toolNames = new Map<number, string>();
    const toolArgs  = new Map<number, string>();

    for await (const event of stream as any) {
      switch (event.type) {
        case "content_block_start":
          if (event.content_block?.type === "text" && event.content_block.text) {
            yield { type: "text_delta", content: event.content_block.text };
          }
          if (event.content_block?.type === "tool_use") {
            toolIds.set(event.index, event.content_block.id);
            toolNames.set(event.index, event.content_block.name);
            toolArgs.set(event.index, "");
            yield { type: "tool_call_start", id: event.content_block.id, name: event.content_block.name };
          }
          break;

        case "content_block_delta":
          if (event.delta?.type === "text_delta") {
            yield { type: "text_delta", content: event.delta.text ?? "" };
          }
          if (event.delta?.type === "input_json_delta") {
            const id = toolIds.get(event.index);
            if (id !== undefined) {
              const chunk = event.delta.partial_json ?? "";
              toolArgs.set(event.index, (toolArgs.get(event.index) ?? "") + chunk);
              yield { type: "tool_call_delta", id, argsJson: chunk };
            }
          }
          break;

        case "content_block_stop": {
          const id = toolIds.get(event.index);
          if (id !== undefined) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(toolArgs.get(event.index) ?? "{}"); } catch {}
            yield { type: "tool_call_end", id, name: toolNames.get(event.index) ?? "", args };
            toolIds.delete(event.index);
            toolNames.delete(event.index);
            toolArgs.delete(event.index);
          }
          break;
        }

        case "message_delta":
          yield {
            type: "message_complete",
            finishReason: event.delta?.stop_reason ?? "end_turn",
            usage: { input: event.usage?.input_tokens ?? 0, output: event.usage?.output_tokens ?? 0 },
          };
          break;

        case "error":
          yield { type: "error", message: event.error?.message ?? "Unknown error" };
          break;
      }
    }
  }

  private toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
    return messages.map((msg): Anthropic.MessageParam => {
      if (msg.role === "assistant" && "toolCalls" in msg && msg.toolCalls?.length) {
        const content: any[] = [];
        if (msg.content) content.push({ type: "text", text: msg.content });
        for (const tc of msg.toolCalls) {
          content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args });
        }
        return { role: "assistant", content };
      }
      if (msg.role === "tool") {
        return { role: "user", content: [{ type: "tool_result", tool_use_id: msg.toolCallId, content: msg.content } as any] };
      }
      return { role: msg.role === "assistant" ? "assistant" : "user", content: msg.content };
    });
  }
}
