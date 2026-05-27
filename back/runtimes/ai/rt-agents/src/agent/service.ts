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
import { createAgentServiceClient } from "g-agent";
import { AgentLogger } from "./telemetry";
import { Service } from "nrpc";

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

class PersistentSessionStore {
  private readonly client = createAgentServiceClient({ baseUrl: process.env.SERVICES_BASE });
  private readonly loopStates = new Map<string, unknown>();

  createSession(model: string)                                          { return this.client.createSession(model); }
  getSession(sessionId: string)                                         { return this.client.getSession(sessionId); }
  listSessions(offset: number, limit: number)                           { return this.client.listSessions({ offset, limit }); }
  deleteSession(sessionId: string)                                      { return this.client.deleteSession(sessionId); }
  getHistory(sessionId: string, maxMessages: number)                    { return this.client.getMessages(sessionId, maxMessages); }
  appendMessage(sessionId: string, message: AgentMessage, usage = 0)   { return this.client.appendMessage(sessionId, message, usage); }
  updateTokenUsage(sessionId: string, input: number, output: number)    { return this.client.updateTokenUsage(sessionId, input, output); }

  saveLoopState(sessionId: string, state: unknown): void  { this.loopStates.set(sessionId, state); }
  deleteLoopState(sessionId: string): void                { this.loopStates.delete(sessionId); }

  async stats(): Promise<{ sessions: number; messages: number; tokens: TokenUsage }> {
    return this.client.getStats();
  }
}

@Service("agent")
export class AgentRuntimeService {
  private store = new PersistentSessionStore();
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
      new AgentLogger(),
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
