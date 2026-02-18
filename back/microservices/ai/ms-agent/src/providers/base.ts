import type { AgentMessage } from "../core/types";

export type ProviderStreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call_delta"; id: string; argsJson: string }
  | { type: "tool_call_end"; id: string; name: string; args: Record<string, unknown> }
  | { type: "message_complete"; finishReason: string; usage: { input: number; output: number } }
  | { type: "error"; message: string };

export interface LLMProviderChatParams {
  messages: AgentMessage[];
  tools?: { name: string; description: string; parameters: any }[];
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface LLMProvider {
  name: string;
  chat(params: LLMProviderChatParams): AsyncGenerator<ProviderStreamEvent>;
}
