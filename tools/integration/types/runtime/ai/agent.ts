/**
 * @nrpc-service agents
 * @nrpc-package g-rt-agents
 */

export enum AgentStreamEventType {
  TEXT_DELTA = "text_delta",
  TOOL_CALL_START = "tool_call_start",
  TOOL_CALL_RESULT = "tool_call_result",
  ITERATION = "iteration",
  COMPLETED = "completed",
  ERROR = "error",
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

export type SessionInfo = {
  id: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export type PaginationParams = {
  offset: number;
  limit: number;
}

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: any;
}

export type TokenUsage = {
  total: number;
  input: number;
  output: number;
}

export interface RuntimeAgentService {
  createSession(model?: string): Promise<SessionInfo>;
  sendMessage(sessionId: string, content: string): AsyncIterable<AgentStreamEvent>;
  getSession(sessionId: string): Promise<SessionInfo>;
  listSessions(params: PaginationParams): Promise<PaginatedResult<SessionInfo>>;
  deleteSession(sessionId: string): Promise<void>;
  listTools(): Promise<ToolDefinition[]>;
  getStats(): Promise<{ sessions: number; messages: number; tokens: TokenUsage }>;
}
