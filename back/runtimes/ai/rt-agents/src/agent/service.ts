import {
  AgentStreamEventType,
  type AgentStreamEvent,
  type PaginatedResult,
  type PaginationParams,
  type SessionInfo,
  type TokenUsage,
  type ToolDefinition,
} from "./types";
import { AgentLoop } from "./core/loop";
import type { AgentMessage, LoopStreamEvent } from "./core/types";
import { BootstrapLoader } from "./bootstrap/loader";
import { ContextBuilder } from "./core/context";
import { ProviderRegistry } from "./providers/registry";
import { ToolRegistry } from "./tools/registry";
import type { Tool } from "./tools/base";

type AgentRuntimeConfig = {
  defaults?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    maxIterations?: number;
  };
  providers?: {
    anthropic?: { apiKey?: string };
    openai?: { apiKey?: string };
  };
  bootstrap?: { dir?: string };
  session?: { maxHistoryMessages?: number };
};

class RuntimeSessionStore {
  private sessions = new Map<string, SessionInfo & { input: number; output: number }>();
  private histories = new Map<string, AgentMessage[]>();
  private loopStates = new Map<string, unknown>();

  async createSession(model: string): Promise<SessionInfo> {
    const now = Date.now();
    const session = {
      id: crypto.randomUUID(),
      model,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      input: 0,
      output: 0,
    };
    this.sessions.set(session.id, session);
    this.histories.set(session.id, []);
    return this.toSessionInfo(session);
  }

  async getSession(sessionId: string): Promise<SessionInfo | undefined> {
    const session = this.sessions.get(sessionId);
    return session ? this.toSessionInfo(session) : undefined;
  }

  async listSessions(offset: number, limit: number): Promise<PaginatedResult<SessionInfo>> {
    const items = Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(offset, offset + limit)
      .map((session) => this.toSessionInfo(session));
    return { items, totalCount: this.sessions.size };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.histories.delete(sessionId);
    this.loopStates.delete(sessionId);
  }

  async getHistory(sessionId: string, maxMessages: number): Promise<AgentMessage[]> {
    return (this.histories.get(sessionId) ?? []).slice(-maxMessages);
  }

  async appendMessage(
    sessionId: string,
    message: AgentMessage,
    tokenUsage: number = 0,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.updatedAt = Date.now();
    session.messageCount += 1;
    session.output += tokenUsage;
    const history = this.histories.get(sessionId) ?? [];
    history.push(message);
    this.histories.set(sessionId, history);
  }

  async updateTokenUsage(sessionId: string, input: number, output: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.input += input;
    session.output += output;
    session.updatedAt = Date.now();
  }

  saveLoopState(sessionId: string, state: unknown): void {
    this.loopStates.set(sessionId, state);
  }

  deleteLoopState(sessionId: string): void {
    this.loopStates.delete(sessionId);
  }

  stats(): { sessions: number; messages: number; tokens: TokenUsage } {
    let messages = 0;
    let input = 0;
    let output = 0;
    for (const session of this.sessions.values()) {
      messages += session.messageCount;
      input += session.input;
      output += session.output;
    }
    return {
      sessions: this.sessions.size,
      messages,
      tokens: { total: input + output, input, output },
    };
  }

  private toSessionInfo(session: SessionInfo & { input: number; output: number }): SessionInfo {
    return {
      id: session.id,
      model: session.model,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
    };
  }
}

export class AgentRuntimeService {
  private store = new RuntimeSessionStore();
  private providerRegistry: ProviderRegistry;
  private toolRegistry = new ToolRegistry();
  private contextBuilder: ContextBuilder;
  private loop: AgentLoop;
  private defaults: Required<NonNullable<AgentRuntimeConfig["defaults"]>>;

  constructor(config: AgentRuntimeConfig = {}) {
    this.defaults = {
      model: config.defaults?.model || process.env.AGENT_MODEL || "claude-sonnet-4-20250514",
      maxTokens: config.defaults?.maxTokens ?? 4096,
      temperature: config.defaults?.temperature ?? 0.7,
      maxIterations: config.defaults?.maxIterations ?? 20,
    };
    this.providerRegistry = new ProviderRegistry({
      anthropic:
        config.providers?.anthropic?.apiKey ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.CLAUDE_API_KEY ||
        "",
      openai: config.providers?.openai?.apiKey || process.env.OPENAI_API_KEY || "",
    });

    this.contextBuilder = new ContextBuilder(
      new BootstrapLoader(config.bootstrap?.dir),
      this.store,
      config.session?.maxHistoryMessages ?? 50,
    );
    this.loop = new AgentLoop(
      this.contextBuilder,
      this.providerRegistry,
      this.toolRegistry,
      this.store,
      this.store,
    );
  }

  registerTool(tool: Tool): void {
    this.toolRegistry.register(tool);
  }

  createSession(model?: string): Promise<SessionInfo> {
    return this.store.createSession(model || this.defaults.model);
  }

  async *sendMessage(sessionId: string, content: string): AsyncIterable<AgentStreamEvent> {
    const session = await this.store.getSession(sessionId);
    if (!session) {
      yield {
        type: AgentStreamEventType.ERROR,
        message: `Session not found: ${sessionId}`,
      };
      return;
    }

    for await (const event of this.loop.run(sessionId, content, {
      model: session.model,
      maxTokens: this.defaults.maxTokens,
      temperature: this.defaults.temperature,
      maxIterations: this.defaults.maxIterations,
    })) {
      yield this.mapEvent(event);
    }
  }

  async getSession(sessionId: string): Promise<SessionInfo> {
    const session = await this.store.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session;
  }

  listSessions(params: PaginationParams): Promise<PaginatedResult<SessionInfo>> {
    return this.store.listSessions(params.offset, params.limit);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.store.deleteSession(sessionId);
  }

  async listTools(): Promise<ToolDefinition[]> {
    return this.toolRegistry.getFunctionDefinitions();
  }

  async getStats(): Promise<{ sessions: number; messages: number; tokens: TokenUsage }> {
    return this.store.stats();
  }

  private mapEvent(event: LoopStreamEvent): AgentStreamEvent {
    switch (event.type) {
      case "text_delta":
        return { type: AgentStreamEventType.TEXT_DELTA, content: event.content, tokens: event.tokens };
      case "tool_call_start":
        return { type: AgentStreamEventType.TOOL_CALL_START, id: event.id, name: event.name, args: event.args };
      case "tool_call_result":
        return { type: AgentStreamEventType.TOOL_CALL_RESULT, id: event.id, name: event.name, result: event.result };
      case "iteration":
        return { type: AgentStreamEventType.ITERATION, iteration: event.iteration, maxIterations: event.maxIterations };
      case "completed":
        return {
          type: AgentStreamEventType.COMPLETED,
          finishReason: event.finishReason,
          totalIterations: event.totalIterations,
          tokens: event.totalTokens.input + event.totalTokens.output,
        };
      case "error":
        return { type: AgentStreamEventType.ERROR, message: event.message };
    }
  }
}
