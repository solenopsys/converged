import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ChatRoomRole, ChatRoomType } from "../../types";

export interface ChatRoomKey extends KeySQL {
  id: string;
}

export interface ChatRoomEntity {
  id: string;
  title?: string | null;
  type: ChatRoomType;
  threadId: string;
  createdBy?: string | null;
  archived: number;
  createdAt: string;
  updatedAt: string;
}

export class ChatRoomRepository extends BaseRepositorySQL<ChatRoomKey, ChatRoomEntity> {}

export interface ChatRoomUserKey extends KeySQL {
  id: string;
}

export interface ChatRoomUserEntity {
  id: string;
  roomId: string;
  userId: string;
  role: ChatRoomRole;
  joinedAt: string;
  updatedAt: string;
}

export class ChatRoomUserRepository extends BaseRepositorySQL<
  ChatRoomUserKey,
  ChatRoomUserEntity
> {}
