import OpenAI from "openai";
import type { LLMProvider, LLMProviderChatParams, ProviderStreamEvent } from "./base";
import type { AgentMessage } from "../core/types";

let client: OpenAI | null = null;

function getClient(apiKey: string): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = getClient(apiKey);
  }

  async *chat(params: LLMProviderChatParams): AsyncGenerator<ProviderStreamEvent> {
    const messages = this.convertMessages(params.messages, params.systemPrompt);

    const tools = params.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const requestParams: any = {
      model: params.model,
      messages,
      stream: true,
    };
    if (params.maxTokens) requestParams.max_tokens = params.maxTokens;
    if (params.temperature !== undefined)
      requestParams.temperature = params.temperature;
    if (tools && tools.length > 0) requestParams.tools = tools;

    const stream = await this.client.chat.completions.create(requestParams);

    // Track tool calls by index in delta
    const pendingCalls: Map<number, { id: string; name: string; argsJson: string }> =
      new Map();

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;

      if (delta?.content) {
        yield { type: "text_delta", content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!pendingCalls.has(idx)) {
            const id = tc.id || `call_${idx}_${Date.now()}`;
            const name = tc.function?.name || "";
            pendingCalls.set(idx, { id, name, argsJson: "" });
            if (name) {
              yield { type: "tool_call_start", id, name };
            }
          }
          const pending = pendingCalls.get(idx)!;
          if (tc.function?.name && !pending.name) {
            pending.name = tc.function.name;
            yield { type: "tool_call_start", id: pending.id, name: pending.name };
          }
          if (tc.function?.arguments) {
            pending.argsJson += tc.function.arguments;
            yield {
              type: "tool_call_delta",
              id: pending.id,
              argsJson: tc.function.arguments,
            };
          }
        }
      }

      if (choice.finish_reason) {
        // Emit tool_call_end for all pending
        for (const [, pending] of pendingCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(pending.argsJson);
          } catch {}
          yield { type: "tool_call_end", id: pending.id, name: pending.name, args };
        }
        pendingCalls.clear();

        yield {
          type: "message_complete",
          finishReason: choice.finish_reason,
          usage: {
            input: chunk.usage?.prompt_tokens || 0,
            output: chunk.usage?.completion_tokens || 0,
          },
        };
      }
    }
  }

  private convertMessages(
    messages: AgentMessage[],
    systemPrompt?: string,
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === "system") continue;

      if (msg.role === "assistant" && msg.toolCalls?.length) {
        result.push({
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          })),
        });
        continue;
      }

      if (msg.role === "tool") {
        result.push({
          role: "tool",
          tool_call_id: msg.toolCallId || "",
          content: msg.content,
        });
        continue;
      }

      result.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    return result;
  }
}
