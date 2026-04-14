import type { RuntimeService, ExecutionEvent, MagicLinkParams, MagicLinkResult } from "g-runtime";
import { createDagServiceClient } from "g-dag";
import { createShedullerServiceClient } from "g-sheduller";
import { CronEngine } from "./engines/cron";
import { sendMagicLink } from "./gates/send-magic-link";
import { Access } from "nrpc";

export class RuntimeServiceImpl implements RuntimeService {
  private dagClient: ReturnType<typeof createDagServiceClient>;
  private shedullerClient: ReturnType<typeof createShedullerServiceClient>;
  private cronEngine: CronEngine;
  private cronRefreshTimer?: ReturnType<typeof setInterval>;
  private scheduledCronIds = new Set<string>();
  private workflowNames: string[] = [];

  constructor(config?: any) {
    const baseUrl = process.env.SERVICES_BASE ?? "http://localhost:3000/services";
    this.dagClient = createDagServiceClient({ baseUrl });
    this.shedullerClient = createShedullerServiceClient({ baseUrl });
    this.workflowNames = this.resolveWorkflowNames(config?.workflows);

    this.cronEngine = new CronEngine((record) => {
      console.log(`[runtime] cron fired: ${record.cronName} success=${record.success}`);
      void this.recordCronHistory(record);
    });

    const refreshIntervalMs = Number(process.env.CRON_REFRESH_INTERVAL_MS || 30000);
    this.cronRefreshTimer = setInterval(() => {
      void this.refreshCrons().catch((error) => {
        this.logRefreshCronsFailure("periodic", error);
      });
    }, Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0 ? refreshIntervalMs : 30000);

    void this.refreshCrons().catch((error) => {
      this.logRefreshCronsFailure("initial", error);
    });

    void this.resumeActiveDagExecutions().catch((error) => {
      this.logResumeDagFailure(error);
    });

    if (typeof config?.registerShutdownTask === "function" && this.cronRefreshTimer) {
      config.registerShutdownTask("runtime:cron-refresh", async () => {
        clearInterval(this.cronRefreshTimer!);
      });
    }
  }

  private resolveWorkflowNames(workflowsConfig: any): string[] {
    const list = Array.isArray(workflowsConfig?.WORKFLOWS) ? workflowsConfig.WORKFLOWS : [];
    const names = list
      .map((entry: any) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.name === "string") return entry.name;
        return "";
      })
      .filter((name: string) => name.length > 0);
    return Array.from(new Set(names));
  }

  private isTemporaryHostUnavailable(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
    return (
      message.includes("unable to connect") ||
      message.includes("connectionrefused") ||
      message.includes("connection refused") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("eai_again") ||
      message.includes("etimedout") ||
      message.includes("request timeout")
    );
  }

  private logRefreshCronsFailure(stage: "initial" | "periodic", error: unknown): void {
    if (this.isTemporaryHostUnavailable(error)) {
      const details = error instanceof Error ? error.message : String(error ?? "unknown error");
      console.info(`[runtime] refreshCrons ${stage}: sheduller host temporarily unavailable (${details})`);
      return;
    }

    console.error(`[runtime] refreshCrons ${stage} failed`, error);
  }

  private logResumeDagFailure(error: unknown): void {
    if (this.isTemporaryHostUnavailable(error)) {
      const details = error instanceof Error ? error.message : String(error ?? "unknown error");
      console.info(`[runtime] resumeActiveExecutions skipped: dag host temporarily unavailable (${details})`);
      return;
    }
    console.error("[runtime] resumeActiveExecutions failed", error);
  }

  private async recordCronHistory(entry: {
    cronId: string;
    cronName: string;
    provider: string;
    action: string;
    success: boolean;
    message?: string;
  }): Promise<void> {
    const recordHistory = (this.shedullerClient as any).recordHistory;
    if (typeof recordHistory !== "function") {
      return;
    }

    try {
      await recordHistory.call(this.shedullerClient, entry);
    } catch (error) {
      if (this.isTemporaryHostUnavailable(error)) {
        const details = error instanceof Error ? error.message : String(error ?? "unknown error");
        console.info(`[runtime] recordCronHistory skipped: sheduller host temporarily unavailable (${details})`);
        return;
      }
      console.error("[runtime] recordCronHistory failed", error);
    }
  }

  private async resumeActiveDagExecutions(): Promise<void> {
    const resume = (this.dagClient as any).resumeActiveExecutions;
    if (typeof resume !== "function") {
      console.info("[runtime] resumeActiveExecutions skipped: g-dag client has no resume method");
      return;
    }

    const summary = await resume.call(this.dagClient, 200);
    if (!summary || typeof summary !== "object") {
      return;
    }

    const resumed = Number((summary as any).resumed ?? 0);
    const skipped = Number((summary as any).skipped ?? 0);
    const failed = Number((summary as any).failed ?? 0);
    if (resumed > 0 || skipped > 0 || failed > 0) {
      console.info(
        `[runtime] resumeActiveExecutions resumed=${resumed} skipped=${skipped} failed=${failed}`,
      );
    }
  }

  async *startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent> {
    try {
      for await (const event of this.dagClient.startExecution(workflowName, params)) {
        yield event as ExecutionEvent;
      }
    } catch (error) {
      console.error(
        `[runtime] startExecution proxy failed workflow=${workflowName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  async createExecution(workflowName: string, params: Record<string, any>): Promise<{ id: string }> {
    try {
      return await this.dagClient.createExecution(workflowName, params);
    } catch (error) {
      console.error(
        `[runtime] createExecution proxy failed workflow=${workflowName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  async listWorkflows(): Promise<{ names: string[] }> {
    return { names: this.workflowNames };
  }

  async refreshCrons(): Promise<void> {
    const list = await this.shedullerClient.listCrons({
      offset: 0,
      limit: 10000,
      status: "active" as any,
    } as any);
    const active = Array.isArray((list as any)?.items) ? (list as any).items as Array<any> : [];
    const activeIds = new Set(active.map((entry) => String(entry.id)));

    for (const id of this.scheduledCronIds) {
      if (!activeIds.has(id)) {
        this.cronEngine.unschedule(id);
      }
    }

    for (const entry of active) {
      if (!entry?.id || !entry?.expression || !entry?.provider || !entry?.action) continue;
      this.cronEngine.schedule(entry);
    }

    this.scheduledCronIds = activeIds;
    console.log(`[runtime] refreshCrons: active=${active.length}`);
  }

  @Access("public")
  async sendMagicLink(params: MagicLinkParams): Promise<MagicLinkResult> {
    await sendMagicLink(params);
    return { success: true };
  }
}

export default RuntimeServiceImpl;
