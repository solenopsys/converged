import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString } from "../../types";

export interface RequestKey extends KeySQL {
  id: string;
}

export interface RequestEntity {
  id: string;
  source?: string | null;
  status: string;
  fields: string;
  files: string;
  createdAt: ISODateString;
}

export class RequestRepository extends BaseRepositorySQL<
  RequestKey,
  RequestEntity
> {}

export interface RequestProcessingKey extends KeySQL {
  id: string;
}

export interface RequestProcessingEntity {
  id: string;
  requestId: string;
  status: string;
  actor: string;
  comment: string;
  createdAt: ISODateString;
}

export class RequestProcessingRepository extends BaseRepositorySQL<
  RequestProcessingKey,
  RequestProcessingEntity
> {}
