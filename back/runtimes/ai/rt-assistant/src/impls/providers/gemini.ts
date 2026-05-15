import { randomUUID } from "crypto";
import type { GoogleGenAI } from "@google/genai";
import type { ChatLLMProvider, ChatMessage, ProviderStreamEvent } from "./base";
import type { ConversationOptions } from "../../types";

export class GeminiProvider implements ChatLLMProvider {
  constructor(private readonly client: GoogleGenAI) {}

  async *stream(messages: ChatMessage[], model: string, options?: ConversationOptions): AsyncGenerator<ProviderStreamEvent> {
    const system = messages.find(m => m.role === "system")?.content;
    const config: any = {
      temperature: options?.temperature,
      maxOutputTokens: options?.maxTokens,
    };
    if (system) config.systemInstruction = system;
    if (options?.tools?.length) {
      config.tools = [{ functionDeclarations: options.tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
    }

    const response = await this.client.models.generateContentStream({
      model,
      contents: this.toGeminiContents(messages.filter(m => m.role !== "system")),
      config,
    });

    let lastChunk: any = null;
    for await (const chunk of response) {
      lastChunk = chunk;
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      const tokens = (chunk.usageMetadata?.promptTokenCount ?? 0) + (chunk.usageMetadata?.candidatesTokenCount ?? 0);

      for (const part of parts) {
        if (part.text) {
          yield { type: "text_delta", content: part.text };
        }
        if (part.functionCall) {
          const id = part.functionCall.id ?? randomUUID();
          const name = part.functionCall.name ?? "";
          const args = part.functionCall.args ?? {};
          yield { type: "tool_call_start", id, name };
          yield { type: "tool_call_end", id, name, args };
        }
      }

      const finishReason = chunk.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "FINISH_REASON_UNSPECIFIED") {
        yield { type: "message_complete", finishReason, usage: { input: chunk.usageMetadata?.promptTokenCount ?? 0, output: chunk.usageMetadata?.candidatesTokenCount ?? 0 } };
        return;
      }
    }

    // Gemini sometimes puts finishReason only in the last chunk together with content
    if (lastChunk) {
      const finishReason = lastChunk.candidates?.[0]?.finishReason;
      if (finishReason) {
        yield { type: "message_complete", finishReason, usage: { input: lastChunk.usageMetadata?.promptTokenCount ?? 0, output: lastChunk.usageMetadata?.candidatesTokenCount ?? 0 } };
      }
    }
  }

  private toGeminiContents(messages: ChatMessage[]): any[] {
    return messages.map(msg => {
      if (msg.role === "assistant" && "toolCalls" in msg && msg.toolCalls?.length) {
        const parts: any[] = [];
        if (msg.content) parts.push({ text: msg.content });
        for (const tc of msg.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.args, id: tc.id } });
        }
        return { role: "model", parts };
      }
      if (msg.role === "tool") {
        return { role: "user", parts: [{ functionResponse: { name: msg.name, response: { result: msg.content }, id: msg.toolCallId } }] };
      }
      return { role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] };
    });
  }
}
