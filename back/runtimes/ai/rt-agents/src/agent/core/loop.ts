import type {
  AgentMessage,
  ToolCallRequest,
  LoopStreamEvent,
} from "./types";
import type { ContextBuilder } from "./context";
import type { ProviderRegistry } from "../providers/registry";
import type { ToolRegistry } from "../tools/registry";

export interface AgentMessageStore {
  appendMessage(sessionId: string, message: AgentMessage, tokenUsage?: number): Promise<void>;
  updateTokenUsage(sessionId: string, input: number, output: number): Promise<void>;
}

export interface AgentProcessingStore {
  saveLoopState(sessionId: string, state: unknown): void | Promise<void>;
  deleteLoopState(sessionId: string): void | Promise<void>;
}

export interface AgentLoopConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  maxIterations: number;
}

export class AgentLoop {
  constructor(
    private contextBuilder: ContextBuilder,
    private providerRegistry: ProviderRegistry,
    private toolRegistry: ToolRegistry,
    private sessionManager: AgentMessageStore,
    private processing: AgentProcessingStore,
  ) {}

  async *run(
    sessionId: string,
    userMessage: string,
    config: AgentLoopConfig,
  ): AsyncGenerator<LoopStreamEvent> {
    const provider = this.providerRegistry.getProviderForModel(config.model);
    const systemPrompt = this.contextBuilder.buildSystemPrompt();
    const toolDefs = this.toolRegistry.getFunctionDefinitions();

    let messages = await this.contextBuilder.buildMessages(
      sessionId,
      userMessage,
    );

    await this.sessionManager.appendMessage(sessionId, {
      role: "user",
      content: userMessage,
    });

    this.processing.saveLoopState(sessionId, {
      sessionId,
      iteration: 0,
      status: "running",
      updatedAt: Date.now(),
    });

    let iteration = 0;
    const totalTokens = { input: 0, output: 0 };

    try {
      while (iteration < config.maxIterations) {
        iteration++;
        yield {
          type: "iteration",
          iteration,
          maxIterations: config.maxIterations,
        };

        const stream = provider.chat({
          messages,
          tools: toolDefs.length > 0 ? toolDefs : undefined,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          systemPrompt,
        });

        let assistantText = "";
        const toolCalls: ToolCallRequest[] = [];
        let finishReason = "end_turn";

        const pendingToolArgs: Map<
          string,
          { name: string; argsJson: string }
        > = new Map();

        for await (const event of stream) {
          switch (event.type) {
            case "text_delta":
              assistantText += event.content;
              yield {
                type: "text_delta",
                content: event.content,
                tokens: totalTokens.input + totalTokens.output,
              };
              break;

            case "tool_call_start":
              pendingToolArgs.set(event.id, {
                name: event.name,
                argsJson: "",
              });
              break;

            case "tool_call_delta": {
              const pending = pendingToolArgs.get(event.id);
              if (pending) {
                pending.argsJson += event.argsJson;
              }
              break;
            }

            case "tool_call_end":
              toolCalls.push({
                id: event.id,
                name: event.name,
                args: event.args,
              });
              pendingToolArgs.delete(event.id);
              yield {
                type: "tool_call_start",
                id: event.id,
                name: event.name,
                args: event.args,
              };
              break;

            case "message_complete":
              finishReason = event.finishReason;
              totalTokens.input += event.usage.input;
              totalTokens.output += event.usage.output;
              break;

            case "error":
              yield { type: "error", message: event.message };
              return;
          }
        }

        const assistantMessage: AgentMessage = {
          role: "assistant",
          content: assistantText,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };

        await this.sessionManager.appendMessage(
          sessionId,
          assistantMessage,
          totalTokens.output,
        );
        messages.push(assistantMessage);

        if (toolCalls.length === 0) {
          break;
        }

        const toolResults = await this.toolRegistry.executeBatch(toolCalls);

        for (const result of toolResults) {
          const toolMessage: AgentMessage = {
            role: "tool",
            content: result.result,
            toolCallId: result.id,
            name: result.name,
          };
          messages.push(toolMessage);
          await this.sessionManager.appendMessage(sessionId, toolMessage);
          yield {
            type: "tool_call_result",
            id: result.id,
            name: result.name,
            result: result.result,
          };
        }

        this.processing.saveLoopState(sessionId, {
          sessionId,
          iteration,
          status: "running",
          updatedAt: Date.now(),
        });
      }

      await this.sessionManager.updateTokenUsage(
        sessionId,
        totalTokens.input,
        totalTokens.output,
      );

      yield {
        type: "completed",
        finishReason:
          iteration >= config.maxIterations ? "max_iterations" : finishReason,
        totalIterations: iteration,
        totalTokens,
      };
    } finally {
      this.processing.deleteLoopState(sessionId);
    }
  }
}
