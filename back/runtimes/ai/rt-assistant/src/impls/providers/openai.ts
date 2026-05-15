import { randomUUID } from "crypto";
import type OpenAI from "openai";
import type { ChatLLMProvider, ChatMessage, ProviderStreamEvent } from "./base";
import type { ConversationOptions } from "../../types";

export class OpenAIProvider implements ChatLLMProvider {
  constructor(private readonly client: OpenAI) {}

  async *stream(messages: ChatMessage[], model: string, options?: ConversationOptions): AsyncGenerator<ProviderStreamEvent> {
    const req: any = {
      model,
      messages: this.toOpenAIMessages(messages),
      stream: true,
      stream_options: { include_usage: true },
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    };
    if (options?.tools?.length) {
      req.tools = options.tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
    }

    const stream = await this.client.chat.completions.create(req);

    const builders = new Map<number, { id: string; name: string; argsJson: string }>();

    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta;
      const finishReason = chunk.choices?.[0]?.finish_reason;

      if (delta?.content) {
        yield { type: "text_delta", content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx: number = tc.index ?? 0;
          if (!builders.has(idx)) {
            const id = tc.id ?? randomUUID();
            builders.set(idx, { id, name: tc.function?.name ?? "", argsJson: "" });
            yield { type: "tool_call_start", id, name: tc.function?.name ?? "" };
          }
          const b = builders.get(idx)!;
          if (tc.id && !b.id) b.id = tc.id;
          if (tc.function?.name && !b.name) b.name = tc.function.name;
          const chunk = tc.function?.arguments ?? "";
          b.argsJson += chunk;
          if (chunk) yield { type: "tool_call_delta", id: b.id, argsJson: chunk };
        }
      }

      if (finishReason) {
        for (const b of builders.values()) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(b.argsJson); } catch {}
          yield { type: "tool_call_end", id: b.id, name: b.name, args };
        }
        const usage = chunk.usage;
        yield {
          type: "message_complete",
          finishReason,
          usage: { input: usage?.prompt_tokens ?? 0, output: usage?.completion_tokens ?? 0 },
        };
      }
    }
  }

  private toOpenAIMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => {
      if (msg.role === "assistant" && "toolCalls" in msg && msg.toolCalls?.length) {
        return {
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        };
      }
      if (msg.role === "tool") {
        return { role: "tool", tool_call_id: msg.toolCallId, content: msg.content };
      }
      return { role: msg.role, content: msg.content };
    });
  }
}
