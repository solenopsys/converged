import { BaseRepositorySQL, KeySQL } from "back-core";

export interface CallKey extends KeySQL {
  id: string;
}

export interface CallEntity {
  id: string;
  startedAt: number;
  phone: string;
  threadId?: string | null;
  recordId: string;
  audioId?: string | null;
  dialogue: string;
  title?: string | null;
  description?: string | null;
  processed: number;
  flud: number;
}

export class CallRepository extends BaseRepositorySQL<CallKey, CallEntity> {}
