import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString } from "../../types";

export interface NotifySendKey extends KeySQL {
  id: string;
}

export interface NotifySendEntity {
  id: string;
  templateId: string;
  channel: string;
  recipient: string;
  params: string;
  status: string;
  createdAt: ISODateString;
}

export class NotifySendRepository extends BaseRepositorySQL<
  NotifySendKey,
  NotifySendEntity
> {}
