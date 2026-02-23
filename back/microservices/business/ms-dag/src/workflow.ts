export type WorkflowStatus = "running" | "done" | "failed";

export interface WorkflowContext {
  runNode(workflowId: string, nodeName: string, fn: () => Promise<any>): Promise<any>;
  setStatus(workflowId: string, status: WorkflowStatus): void;
}

export abstract class Workflow {
  readonly id: string;

  constructor(private ctx: WorkflowContext, id?: string) {
    this.id = id ?? crypto.randomUUID();
  }

  protected async invoke<T = any>(nodeName: string, fn: () => Promise<T>): Promise<T> {
    return this.ctx.runNode(this.id, nodeName, fn);
  }

  async start(params: any): Promise<void> {
    try {
      this.ctx.setStatus(this.id, "running");
      await this.execute(params);
      this.ctx.setStatus(this.id, "done");
    } catch (e) {
      this.ctx.setStatus(this.id, "failed");
      throw e;
    }
  }

  abstract execute(params: any): Promise<void>;
}
