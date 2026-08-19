import { BaseRepositorySQL, type KeySQL } from "back-core";

export interface SessionKey extends KeySQL {
  id: string;
}

export interface SessionEntity {
  id: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokensInput: number;
  totalTokensOutput: number;
}

export interface MessageKey extends KeySQL {
  id: string;
}

export interface MessageEntity {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolCalls: string;
  toolCallId: string;
  tokenUsage: number;
  createdAt: number;
}
