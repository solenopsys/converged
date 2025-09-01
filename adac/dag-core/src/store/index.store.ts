import { Kysely } from 'kysely';

// Константы названий таблиц
export const TABLE_NAMES = {
  RUNS: 'runs',
  NODES: 'nodes', 
  EVENTS: 'events'
} as const;

// Типы статусов
export type RunStatus = 'succeeded' | 'failed' | 'canceled' | 'timeout';
export type NodeStatus = 'succeeded' | 'failed' | 'timeout' | null;
export type EventStatus = 'ready' | 'reserved' | 'done' | 'dead';

// Типы таблиц
export type RunsTable = {
  pid: Uint8Array;
  workflow: string;
  started_at: number;
  finished_at: number | null;
  status: RunStatus;
};

export type NodesTable = {
  pid: Uint8Array;
  node_name: string;
  kind: string;
  started_at: number | null;
  finished_at: number | null;
  status: NodeStatus;
  error_code: string | null;
};

export type EventsTable = {
  event_id: Uint8Array;
  source: string;
  payload: string | null;
  enqueued_at: number;
  status: EventStatus;
  pid: Uint8Array | null;
  error: string | null;
};

// База данных
export type Database = {
  [TABLE_NAMES.RUNS]: RunsTable;
  [TABLE_NAMES.NODES]: NodesTable;
  [TABLE_NAMES.EVENTS]: EventsTable;
};

export class IndexStore  { 
  private index: Kysely<Database>;

  constructor(index: Kysely<Database>) {
    this.index = index;
  }

 
  
  async indexRun(pid: Uint8Array, workflow: string, status: RunStatus = 'succeeded'): Promise<void> {
    await this.index.insertInto(TABLE_NAMES.RUNS).values({
      pid,
      workflow,
      started_at: Date.now(),
      finished_at: null,
      status
    }).execute();
  }

  async updateRunStatus(pid: Uint8Array, status: RunStatus): Promise<void> {
    const updates: Partial<Database[typeof TABLE_NAMES.RUNS]> = { status };
    if (status !== 'succeeded') {
      updates.finished_at = Date.now();
    }
    
    await this.index.updateTable(TABLE_NAMES.RUNS).set(updates).where('pid', '=', pid).execute();
  }

  async finishRun(pid: Uint8Array, status: RunStatus): Promise<void> {
    await this.index.updateTable(TABLE_NAMES.RUNS).set({
      status,
      finished_at: Date.now()
    }).where('pid', '=', pid).execute();
  }

 
  async indexNode(pid: Uint8Array, nodeName: string, kind: string): Promise<void> {
    await this.index.insertInto(TABLE_NAMES.NODES).values({
      pid,
      node_name: nodeName,
      kind,
      started_at: null,
      finished_at: null,
      status: null,
      error_code: null
    }).execute();
  }

  async startNode(pid: Uint8Array, nodeName: string): Promise<void> {
    await this.index.updateTable(TABLE_NAMES.NODES).set({
      started_at: Date.now()
    })
    .where('pid', '=', pid)
    .where('node_name', '=', nodeName)
    .execute();
  }

  async finishNode(
    pid: Uint8Array, 
    nodeName: string, 
    status: NodeStatus, 
    errorCode?: string
  ): Promise<void> {
    await this.index.updateTable(TABLE_NAMES.NODES).set({
      finished_at: Date.now(),
      status,
      error_code: errorCode || null
    })
    .where('pid', '=', pid)
    .where('node_name', '=', nodeName)
    .execute();
  }

  // === EVENTS (события/очередь) ===
  
  async indexEvent(
    eventId: Uint8Array,
    source: string,
    status: EventStatus = 'ready',
    payload?: string
  ): Promise<void> {
    await this.index.insertInto(TABLE_NAMES.EVENTS).values({
      event_id: eventId,
      source,
      payload: payload || null,
      enqueued_at: Date.now(),
      status,
      pid: null,
      error: null
    }).execute();
  }

  async updateEventStatus(eventId: Uint8Array, status: EventStatus, error?: string): Promise<void> {
    await this.index.updateTable(TABLE_NAMES.EVENTS).set({
      status,
      error: error || null
    }).where('event_id', '=', eventId).execute();
  }

  async linkEventToRun(eventId: Uint8Array, pid: Uint8Array): Promise<void> {
    await this.index.updateTable(TABLE_NAMES.EVENTS).set({ pid }).where('event_id', '=', eventId).execute();
  }

  // === ПОИСКОВЫЕ МЕТОДЫ ===

  // Runs
  async getRunsByWorkflow(workflow: string) {
    return await this.index
      .selectFrom(TABLE_NAMES.RUNS)
      .where('workflow', '=', workflow)
      .selectAll()
      .orderBy('started_at', 'desc')
      .execute();
  }

  async getRunsByStatus(status: RunStatus) {
    return await this.index
      .selectFrom(TABLE_NAMES.RUNS)
      .where('status', '=', status)
      .selectAll()
      .orderBy('started_at', 'desc')
      .execute();
  }

  async getRecentRuns(limit: number = 100) {
    return await this.index
      .selectFrom(TABLE_NAMES.RUNS)
      .selectAll()
      .orderBy('started_at', 'desc')
      .limit(limit)
      .execute();
  }

  // Nodes
  async getNodesByRun(pid: Uint8Array) {
    return await this.index
      .selectFrom(TABLE_NAMES.NODES)
      .where('pid', '=', pid)
      .selectAll()
      .execute();
  }

  async getNodesByKind(kind: string) {
    return await this.index
      .selectFrom(TABLE_NAMES.NODES)
      .where('kind', '=', kind)
      .selectAll()
      .execute();
  }

  async getFailedNodes(limit: number = 100) {
    return await this.index
      .selectFrom(TABLE_NAMES.NODES)
      .where('status', '=', 'failed')
      .selectAll()
      .orderBy('finished_at', 'desc')
      .limit(limit)
      .execute();
  }

  // Events
  async getEventsByStatus(status: EventStatus) {
    return await this.index
      .selectFrom(TABLE_NAMES.EVENTS)
      .where('status', '=', status)
      .selectAll()
      .orderBy('enqueued_at', 'asc')
      .execute();
  }

  async getEventsBySource(source: string) {
    return await this.index
      .selectFrom(TABLE_NAMES.EVENTS)
      .where('source', '=', source)
      .selectAll()
      .orderBy('enqueued_at', 'desc')
      .execute();
  }

  async getPendingEvents() {
    return await this.index
      .selectFrom(TABLE_NAMES.EVENTS)
      .where('status', 'in', ['ready', 'reserved'])
      .selectAll()
      .orderBy('enqueued_at', 'asc')
      .execute();
  }

  // === СТАТИСТИКА ===
  
  async getWorkflowStats() {
    return await this.index
      .selectFrom(TABLE_NAMES.RUNS)
      .select(['workflow', 'status'])
      .select((eb) => eb.fn.count('pid').as('count'))
      .groupBy(['workflow', 'status'])
      .execute();
  }

  async getNodeKindStats() {
    return await this.index
      .selectFrom(TABLE_NAMES.NODES)
      .select(['kind', 'status'])
      .select((eb) => eb.fn.count('*').as('count'))
      .groupBy(['kind', 'status'])
      .execute();
  }

  // === ОЧИСТКА ===
  
  async cleanupOldRuns(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    
    const result = await this.index
      .deleteFrom(TABLE_NAMES.RUNS)
      .where('started_at', '<', cutoff)
      .where('status', 'in', ['succeeded', 'failed', 'canceled', 'timeout'])
      .executeTakeFirst();
      
    return Number(result.numDeletedRows || 0);
  }

  async cleanupOldEvents(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    
    const result = await this.index
      .deleteFrom(TABLE_NAMES.EVENTS)
      .where('enqueued_at', '<', cutoff)
      .where('status', 'in', ['done', 'dead'])
      .executeTakeFirst();
      
    return Number(result.numDeletedRows || 0);
  }

  // === УТИЛИТЫ ===
  
 
  async deinit(): Promise<void> {
    await this.index.destroy();
  }
}