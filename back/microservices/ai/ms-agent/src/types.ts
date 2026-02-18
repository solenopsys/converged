export enum AgentStreamEventType {
  TEXT_DELTA = "text_delta",
  TOOL_CALL_START = "tool_call_start",
  TOOL_CALL_RESULT = "tool_call_result",
  ITERATION = "iteration",
  COMPLETED = "completed",
  ERROR = "error",
}

export interface SessionInfo {
  id: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

export interface TokenUsage {
  total: number;
  input: number;
  output: number;
}

export type AgentStreamEvent = {
  tokens?: number;
} & (
  | { type: AgentStreamEventType.TEXT_DELTA; content: string }
  | { type: AgentStreamEventType.TOOL_CALL_START; id: string; name: string; args: any }
  | { type: AgentStreamEventType.TOOL_CALL_RESULT; id: string; name: string; result: string }
  | { type: AgentStreamEventType.ITERATION; iteration: number; maxIterations: number }
  | { type: AgentStreamEventType.COMPLETED; finishReason: string; totalIterations: number }
  | { type: AgentStreamEventType.ERROR; message: string }
);

export interface AgentServiceConfig {
  defaults: {
    model: string;
    maxTokens: number;
    temperature: number;
    maxIterations: number;
  };
  providers: {
    anthropic?: { apiKey: string; apiBase?: string };
    openai?: { apiKey: string; apiBase?: string };
  };
  bootstrap: { dir?: string };
  session: { maxHistoryMessages: number };
}
