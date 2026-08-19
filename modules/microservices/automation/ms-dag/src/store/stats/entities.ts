import { BaseRepositorySQL, KeySQL } from "back-core";

export interface ProcessKey extends KeySQL {
  id: string;
}

export interface ProcessEntity {
  id: string;
  workflow_id: string | null;
  status: string;
  started_at: number | null;
  updated_at: number | null;
  created_at: number | null;
  meta: string | null;
}

export class ProcessRepository extends BaseRepositorySQL<
  ProcessKey,
  ProcessEntity
> {}

export interface NodeKey extends KeySQL {
  id: number;
}

export interface NodeEntity {
  id: number;
  process_id: string;
  node_id: string;
  state: string;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
  retry_count: number;
  created_at: number | null;
  updated_at: number | null;
  record_id: string | null;
}

export class NodeRepository extends BaseRepositorySQL<NodeKey, NodeEntity> {}
