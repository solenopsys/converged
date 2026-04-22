export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface AgentMessage {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCallRequest[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  result: string;
  isError: boolean;
}

export type LoopStreamEvent =
  | { type: "text_delta"; content: string; tokens: number }
  | { type: "tool_call_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_call_result"; id: string; name: string; result: string }
  | { type: "iteration"; iteration: number; maxIterations: number }
  | {
      type: "completed";
      finishReason: string;
      totalIterations: number;
      totalTokens: { input: number; output: number };
    }
  | { type: "error"; message: string };
