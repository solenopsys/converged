// Константы для ключей
const PROCESS = "process";
const TRIGGER = "trigger"; 
const RESULT = "result";
const START = "start";

import { generateULID } from "./utils/utils";
import { LMWrapper } from "./utils/lmwrapper";

export class ProcessStore {
  private processes: LMWrapper;

  constructor(dataDir: string) {
    this.processes = new LMWrapper(dataDir, 'process');
  }

  // Добавленные методы для работы с процессами
  createProcess(id: string, workflowId?: string, meta?: any): void {
    this.processes.put([PROCESS, id], {
      created_at: new Date(),
      workflow_id: workflowId,
      meta
    });
  }

  getProcess(id: string): any {
    return this.processes.get([PROCESS, id]);
  }

  // Методы для работы с внешними событиями (очереди, триггеры)
  storeTrigger(processId: string, type: string, nodeId?: string, payload?: any, executorId?: string): string {
    const ulid = generateULID();
    
    this.processes.put([TRIGGER, processId, ulid], {
      type,
      node_id: nodeId,
      payload,
      ts: new Date(),
      executor_id: executorId
    });
    
    return ulid;
  }

  getProcessTriggers(processId: string): any[] {
    const keys = this.processes.getKeysWithPrefix([TRIGGER, processId]);
    const events: any[] = [];
    
    for (const key of keys) {
      // Извлекаем ULID из ключа для получения события
      const keyParts = key.split(':');
      const ulid = keyParts[2];
      const event = this.processes.get([TRIGGER, processId, ulid]);
      events.push(event);
    }
    
    return events;
  }

  // === Методы для работы с DAG состоянием ===

  // Добавить попытку запуска узла
  addNodeStart(processId: string, nodeId: string, owner: string, executorId?: string): string {
    const ts = generateULID();
    
    this.processes.put([processId, START, nodeId, ts], {
      owner,
      lease: new Date(),
      executor_id: executorId
    });
    
    return ts;
  }

  // Получить все попытки запуска узла
  getNodeStarts(processId: string, nodeId: string): any[] {
    const keys = this.processes.getKeysWithPrefix([processId, START, nodeId]);
    const starts: any[] = [];
    
    for (const key of keys) {
      const keyParts = key.split(':');
      const ts = keyParts[3];
      const start = this.processes.get([processId, START, nodeId, ts]);
      starts.push({ ts, ...start });
    }
    
    return starts;
  }

  // Получить все активные попытки процесса
  getAllStarts(processId: string): Array<{nodeId: string, ts: string, data: any}> {
    const keys = this.processes.getKeysWithPrefix([processId, START]);
    const starts: Array<{nodeId: string, ts: string, data: any}> = [];
    
    for (const key of keys) {
      const keyParts = key.split(':');
      const nodeId = keyParts[2];
      const ts = keyParts[3];
      const data = this.processes.get([processId, START, nodeId, ts]);
      starts.push({ nodeId, ts, data });
    }
    
    return starts;
  }

  // Установить результат узла (write-once)
  setNodeResult(processId: string, nodeId: string, status: string, data?: any): void {
    this.processes.put([processId, RESULT, nodeId], {
      status,
      data,
      ts: new Date()
    });
  }

  // Получить результат узла
  getNodeResult(processId: string, nodeId: string): any {
    return this.processes.get([processId, RESULT, nodeId]);
  }

  // Получить все результаты процесса
  getAllResults(processId: string): Array<{nodeId: string, result: any}> {
    const keys = this.processes.getKeysWithPrefix([processId, RESULT]);
    const results: Array<{nodeId: string, result: any}> = [];
    
    for (const key of keys) {
      const keyParts = key.split(':');
      const nodeId = keyParts[2];
      const result = this.processes.get([processId, RESULT, nodeId]);
      results.push({ nodeId, result });
    }
    
    return results;
  }

  // Получить ID завершенных узлов
  getCompletedNodeIds(processId: string): string[] {
    const keys = this.processes.getKeysWithPrefix([processId, RESULT]);
    return keys.map(key => key.split(':')[2]);
  }

  // Установить tombstone для остановки процесса
  killProcess(processId: string, reason: string): void {
    this.processes.put([processId, "tombstone"], {
      reason,
      ts: new Date()
    });
  }

  // Проверить tombstone
  getProcessTombstone(processId: string): any {
    return this.processes.get([processId, "tombstone"]);
  }

  isProcessKilled(processId: string): boolean {
    return this.getProcessTombstone(processId) !== null;
  }



  deinit(): void {
    this.processes.close();
  }
}