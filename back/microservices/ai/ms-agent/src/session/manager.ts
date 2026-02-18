import { randomUUID } from "crypto";
import type { StoresController } from "../store";
import type { AgentMessage } from "../core/types";
import type { SessionInfo } from "../types";
import type { MessageEntity } from "../store/history/entities";

export class SessionManager {
  private activeHistories: Map<string, AgentMessage[]> = new Map();

  constructor(private stores: StoresController) {}

  async createSession(model: string): Promise<SessionInfo> {
    const id = randomUUID();
    const now = Date.now();
    const entity = await this.stores.history.sessions.create({
      id,
      model,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
    } as any);
    this.activeHistories.set(id, []);
    return this.toSessionInfo(entity);
  }

  async getSession(sessionId: string): Promise<SessionInfo | undefined> {
    const entity = await this.stores.history.sessions.findById({
      id: sessionId,
    });
    return entity ? this.toSessionInfo(entity) : undefined;
  }

  async listSessions(
    offset: number,
    limit: number,
  ): Promise<{ items: SessionInfo[]; totalCount: number }> {
    const entities = await this.stores.history.sessions.findAll({
      limit,
      offset,
      orderBy: [{ field: "updatedAt", direction: "desc" }],
    });
    const totalCount = await this.stores.history.sessions.count();
    return { items: entities.map((e) => this.toSessionInfo(e)), totalCount };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.activeHistories.delete(sessionId);
    await this.stores.history.sessions.delete({ id: sessionId });
  }

  async getHistory(
    sessionId: string,
    maxMessages: number,
  ): Promise<AgentMessage[]> {
    if (this.activeHistories.has(sessionId)) {
      const history = this.activeHistories.get(sessionId)!;
      return history.slice(-maxMessages);
    }

    const entities = await this.stores.history.getSessionMessages(
      sessionId,
      maxMessages,
    );
    const messages = entities.map((e) => this.entityToAgentMessage(e));
    this.activeHistories.set(sessionId, messages);
    return messages;
  }

  async appendMessage(
    sessionId: string,
    message: AgentMessage,
    tokenUsage: number = 0,
  ): Promise<void> {
    const id = randomUUID();
    const now = Date.now();

    await this.stores.history.messages.create({
      id,
      sessionId,
      role: message.role,
      content: message.content || "",
      toolCalls: message.toolCalls ? JSON.stringify(message.toolCalls) : "",
      toolCallId: message.toolCallId || "",
      tokenUsage,
      createdAt: now,
    } as any);

    await this.stores.history.sessions.update(
      { id: sessionId },
      { updatedAt: now },
    );

    if (!this.activeHistories.has(sessionId)) {
      this.activeHistories.set(sessionId, []);
    }
    this.activeHistories.get(sessionId)!.push(message);
  }

  async updateTokenUsage(
    sessionId: string,
    input: number,
    output: number,
  ): Promise<void> {
    const session = await this.stores.history.sessions.findById({
      id: sessionId,
    });
    if (session) {
      await this.stores.history.sessions.update(
        { id: sessionId },
        {
          totalTokensInput: session.totalTokensInput + input,
          totalTokensOutput: session.totalTokensOutput + output,
          updatedAt: Date.now(),
        },
      );
    }
  }

  private toSessionInfo(entity: any): SessionInfo {
    return {
      id: entity.id,
      model: entity.model,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      messageCount: entity.messageCount,
    };
  }

  private entityToAgentMessage(entity: MessageEntity): AgentMessage {
    return {
      role: entity.role as AgentMessage["role"],
      content: entity.content,
      toolCalls: entity.toolCalls ? JSON.parse(entity.toolCalls) : undefined,
      toolCallId: entity.toolCallId || undefined,
    };
  }
}
