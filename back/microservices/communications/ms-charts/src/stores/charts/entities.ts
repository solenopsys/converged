import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ChartRoomRole, ChartRoomType } from "../../types";

export interface ChartRoomKey extends KeySQL {
  id: string;
}

export interface ChartRoomEntity {
  id: string;
  title?: string | null;
  type: ChartRoomType;
  threadId: string;
  createdBy?: string | null;
  archived: number;
  createdAt: string;
  updatedAt: string;
}

export class ChartRoomRepository extends BaseRepositorySQL<ChartRoomKey, ChartRoomEntity> {}

export interface ChartRoomUserKey extends KeySQL {
  id: string;
}

export interface ChartRoomUserEntity {
  id: string;
  roomId: string;
  userId: string;
  role: ChartRoomRole;
  joinedAt: string;
  updatedAt: string;
}

export class ChartRoomUserRepository extends BaseRepositorySQL<
  ChartRoomUserKey,
  ChartRoomUserEntity
> {}
