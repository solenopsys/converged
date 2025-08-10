import { Kysely, SqliteDialect } from 'kysely';
import Database from 'bun:sqlite';
import * as lmdb from 'lmdb';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { extractConstructorParams } from './ts-parser';
import { HashString } from '../../../types/interface';
import { genHash } from '../tools';
import { preciseStringfy } from '../tools';
import { Database as DBTypes, ProcessStatus, NodeState } from './types';

interface MetadataDB {
  metadata: {
    id: number;
    version: string;
    data: string;
  };
}

export class StoreService {
  private static instance: StoreService;
  private index: Kysely<DBTypes>;
  private dag: lmdb.Database;
  private processes: lmdb.Database;

  private constructor() {
    const dataDir = process.env.DATA_DIR || './data';
    mkdirSync(dataDir, { recursive: true });

    this.index = new Kysely({
      dialect: new SqliteDialect({
        database: new Database(join(dataDir, 'index.sqlite'))
      })
    });

    this.dag = lmdb.open(join(dataDir, 'dag.lmdb'));
    this.processes = lmdb.open(join(dataDir, 'processes.lmdb'));
  }

  public static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  getKeysWithPrefix(prefix: string) {
    return this.getKeysWithRange(prefix + ":", prefix + ";")
  }

  getKeysWithRange(start: string, end: string): string[] {
    const keys: string[] = [];
    console.log("range", start, "-", end)
    const range = this.dag.getRange({ start, end })
    for (const { key, value } of range) {
      console.log("fkey", key)
      keys.push(key as string);
    }
    return keys;
  }

  saveCode(body: string) {
    const hashString = genHash(body);
    this.dag.put("code:" + hashString, body);
    return hashString;
  }

  listNodeCode(): string[] {
    const keys = this.getKeysWithPrefix("node_code")
    const names: Set<string> = new Set();
    for (const key of keys) {
      const name = key.split(":")[1];
      names.add(name);
    }
    return Array.from(names);
  }

  stats(): any {
    return this.dag.getStats()
  }

  getCode(hashString: string): string {
    return this.dag.get("code:" + hashString);
  }

  getNode(hashString: string): any {
    return JSON.parse(this.dag.get("node:" + hashString));
  }

  createNodeCode(name: string, hash: HashString): Promise<{ version: number, fields: { name: string, type: string }[] }> {
    const code = this.getCode(hash);
    const timeVersion = new Date().getTime();
    const key = `node_code:${name}:${timeVersion}`;

    const constructorParams = extractConstructorParams(code);
    const struct = {
      code_hash: hash,
      params: constructorParams
    }
    this.dag.put(key, code)
    return { version: timeVersion, fields: constructorParams };
  }

  getLastVersion(prefix: string) {
    const keys = this.getKeysWithPrefix(prefix)
    const lastKey = keys[keys.length - 1]
    const version = lastKey.split(":")[2]
    return version;
  }

  createNode(nodeCodeName: string, config: any): Promise<{ hash: HashString }> {
    const nodeCodeVersion = this.getLastVersion("node_code:" + nodeCodeName);
    const struct = {
      config: config,
      codeName: nodeCodeName,
      codeVersion: nodeCodeVersion
    }
    const configString = preciseStringfy(struct);
    const hashString = genHash(configString);
    const key = `node:${hashString}`;

    this.dag.put(key, struct)
    return { hash: hashString };
  }

  // Добавленные методы для работы с процессами
  createProcess(id: string, workflowId?: string, meta?: any): void {
    this.processes.put(`process:${id}`, {
      created_at: new Date(),
      workflow_id: workflowId,
      meta
    });
  }

  getProcess(id: string): any {
    return this.processes.get(`process:${id}`);
  }

  // Методы для работы с событиями
  storeEvent(processId: string, type: string, nodeId?: string, payload?: any, executorId?: string): string {
    const ulid = this.generateULID();
    const key = `event:${processId}:${ulid}`;
    
    this.processes.put(key, {
      type,
      node_id: nodeId,
      payload,
      ts: new Date(),
      executor_id: executorId
    });
    
    return ulid;
  }

  getProcessEvents(processId: string): any[] {
    const prefix = `event:${processId}:`;
    const events: any[] = [];
    const range = this.processes.getRange({ start: prefix, end: prefix + '\xFF' });
    
    for (const { value } of range) {
      events.push(value);
    }
    return events;
  }

  // Методы для работы с workflow
  createWorkflowConfig(hash: string, nodes: any[], links: any[], description?: string): void {
    this.dag.put(`workflow_config:${hash}`, {
      nodes,
      links,
      description
    });
  }

  getWorkflowConfig(hash: string): any {
    return this.dag.get(`workflow_config:${hash}`);
  }

  createWorkflow(name: string, version: string, workflowVersionHash: string): void {
    this.dag.put(`workflow:${name}:${version}`, {
      workflow_version_hash: workflowVersionHash
    });
  }

  getWorkflow(name: string, version: string): any {
    return this.dag.get(`workflow:${name}:${version}`);
  }

  // Методы для работы с webhook
  createWebhook(name: string, version: string, url: string, method: string, workflowId: string, options?: any): void {
    this.dag.put(`webhook:${name}:${version}`, {
      url,
      method,
      workflow_id: workflowId,
      options
    });
  }

  getWebhook(name: string, version: string): any {
    return this.dag.get(`webhook:${name}:${version}`);
  }

  // Индексные методы для быстрого поиска (используют SQLite)
  async indexProcess(id: string, workflowId?: string, status: ProcessStatus = 'queued', meta?: string): Promise<void> {
    await this.index.insertInto('process').values({
      id,
      workflow_id: workflowId,
      status,
      meta
    }).execute();
  }

  async updateProcessStatus(id: string, status: ProcessStatus): Promise<void> {
    await this.index.updateTable('process').set({ status }).where('id', '=', id).execute();
  }

  async indexNode(processId: string, nodeId: string, state: NodeState = 'queued'): Promise<void> {
    await this.index.insertInto('nodes').values({
      process_id: processId,
      node_id: nodeId,
      state
    }).execute();
  }

  async updateNodeState(processId: string, nodeId: string, state: NodeState, errorMessage?: string): Promise<void> {
    const updates: any = { state };
    if (state === 'running') updates.started_at = new Date();
    if (state === 'done' || state === 'failed') updates.completed_at = new Date();
    if (errorMessage) updates.error_message = errorMessage;
    
    await this.index.updateTable('nodes').set(updates)
      .where('process_id', '=', processId)
      .where('node_id', '=', nodeId)
      .execute();
  }

  // Поисковые методы через индекс
  async getProcessesByStatus(status: ProcessStatus) {
    return await this.index.selectFrom('process').where('status', '=', status).selectAll().execute();
  }

  async getProcessesByWorkflow(workflowId: string) {
    return await this.index.selectFrom('process').where('workflow_id', '=', workflowId).selectAll().execute();
  }

  async getNodesByProcess(processId: string) {
    return await this.index.selectFrom('nodes').where('process_id', '=', processId).selectAll().execute();
  }

  async getNodesByState(state: NodeState) {
    return await this.index.selectFrom('nodes').where('state', '=', state).selectAll().execute();
  }

  private generateULID(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  deinit() {
    this.index.destroy();
    this.dag.close();
    this.processes.close();
  }
}