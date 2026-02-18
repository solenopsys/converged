import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMProviderChatParams, ProviderStreamEvent } from "./base";
import type { AgentMessage } from "../core/types";

let client: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export class ClaudeProvider implements LLMProvider {
  name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = getClient(apiKey);
  }

  async *chat(params: LLMProviderChatParams): AsyncGenerator<ProviderStreamEvent> {
    const messages = this.convertMessages(params.messages);

    const tools = params.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));

    const requestParams: any = {
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      messages,
      stream: true,
    };
    if (params.systemPrompt) requestParams.system = params.systemPrompt;
    if (tools && tools.length > 0) requestParams.tools = tools;

    const stream = await this.client.messages.create(requestParams);

    // Track tool calls by content block index
    const blockToolIds: Map<number, string> = new Map();
    const blockToolNames: Map<number, string> = new Map();
    const blockToolArgs: Map<number, string> = new Map();

    for await (const event of stream as any) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block?.type === "text" && block.text) {
          yield { type: "text_delta", content: block.text };
        }
        if (block?.type === "tool_use") {
          blockToolIds.set(event.index, block.id);
          blockToolNames.set(event.index, block.name);
          blockToolArgs.set(event.index, "");
          yield { type: "tool_call_start", id: block.id, name: block.name };
        }
      }

      if (event.type === "content_block_delta") {
        if (event.delta?.type === "text_delta") {
          yield { type: "text_delta", content: event.delta.text || "" };
        }
        if (event.delta?.type === "input_json_delta") {
          const idx = event.index;
          const id = blockToolIds.get(idx);
          if (id !== undefined) {
            const current = blockToolArgs.get(idx) || "";
            blockToolArgs.set(idx, current + (event.delta.partial_json || ""));
            yield { type: "tool_call_delta", id, argsJson: event.delta.partial_json || "" };
          }
        }
      }

      if (event.type === "content_block_stop") {
        const idx = event.index;
        const id = blockToolIds.get(idx);
        if (id !== undefined) {
          const argsJson = blockToolArgs.get(idx) || "{}";
          const name = blockToolNames.get(idx) || "";
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(argsJson);
          } catch {}
          yield { type: "tool_call_end", id, name, args };
          blockToolIds.delete(idx);
          blockToolNames.delete(idx);
          blockToolArgs.delete(idx);
        }
      }

      if (event.type === "message_delta") {
        yield {
          type: "message_complete",
          finishReason: event.delta?.stop_reason || "end_turn",
          usage: {
            input: event.usage?.input_tokens || 0,
            output: event.usage?.output_tokens || 0,
          },
        };
      }
    }
  }

  private convertMessages(messages: AgentMessage[]): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== "system")
      .map((msg): Anthropic.MessageParam => {
        if (msg.role === "assistant" && msg.toolCalls?.length) {
          const content: Anthropic.ContentBlock[] = [];
          if (msg.content) {
            content.push({ type: "text", text: msg.content } as any);
          }
          for (const tc of msg.toolCalls) {
            content.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.args,
            } as any);
          }
          return { role: "assistant", content };
        }

        if (msg.role === "tool") {
          return {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: msg.toolCallId,
                content: msg.content,
              } as any,
            ],
          };
        }

        return {
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        };
      });
  }
}
