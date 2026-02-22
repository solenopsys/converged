export type WorkflowStatus = "running" | "done" | "failed";

/**
 * Инфраструктурный объект, передаваемый ядром в воркфлоу.
 * Воркфлоу не знает о конкретных хранилищах — только работает через этот интерфейс.
 * Реализация живёт в ядре и может эволюционировать независимо.
 */
export interface WorkflowContext {
  getStep(workflowId: string, nodeName: string): string | undefined;  // возвращает nodeRecordId
  setStep(workflowId: string, nodeName: string, nodeRecordId: string): void;
  setStatus(workflowId: string, status: WorkflowStatus): void;
}

export abstract class Workflow {
  readonly id: string;

  constructor(private ctx: WorkflowContext, id?: string) {
    this.id = id ?? crypto.randomUUID();
    if (!id) {
      this.ctx.setStatus(this.id, "running");
    }
  }

  /**
   * Идемпотентный вызов узла.
   * KV хранит не результат, а nodeRecordId — ссылку на запись NodeProcessor.
   * Если узел уже выполнен — fn() не вызывается, возвращается сохранённый id.
   */
  protected async invoke(nodeName: string, fn: () => Promise<string>): Promise<string> {
    const cached = this.ctx.getStep(this.id, nodeName);
    if (cached !== undefined) return cached;
    const nodeRecordId = await fn();
    this.ctx.setStep(this.id, nodeName, nodeRecordId);
    return nodeRecordId;
  }

  async start(params: any): Promise<void> {
    try {
      await this.execute(params);
      this.ctx.setStatus(this.id, "done");
    } catch (e) {
      this.ctx.setStatus(this.id, "failed");
      throw e;
    }
  }

  abstract execute(params: any): Promise<void>;
}
