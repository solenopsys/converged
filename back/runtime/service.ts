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

  constructor(config?: any) {
    const baseUrl = process.env.SERVICES_BASE ?? "http://localhost:3000/services";
    this.dagClient = createDagServiceClient({ baseUrl });
    this.shedullerClient = createShedullerServiceClient({ baseUrl });

    const workflows = config?.workflows ?? {};
    const list: any[] = workflows.WORKFLOWS ?? [];
    const ctors = new Map(
      list.filter((w: any) => w.name && w.ctor).map((w: any) => [w.name, w.ctor]),
    );

    if (typeof workflows.initProvidersPool === "function") {
      const openai = config?.openai;
      const gemini = config?.gemini;
      workflows.initProvidersPool({
        async getProvider(name: string) {
          if (name === "openai" && openai?.key)
            return { codeName: "openai", config: { token: openai.key, model: openai.model ?? "gpt-4o-mini" } };
          if (name === "gemini" && gemini?.key)
            return { codeName: "gemini", config: { token: gemini.key, model: gemini.model ?? "gemini-3.1-flash-lite" } };
          throw new Error(`Provider "${name}" not configured`);
        },
      });
    }

    this.cronEngine = new CronEngine((record) => {
      console.log(`[runtime] cron fired: ${record.cronName} success=${record.success}`);
    });

    const refreshIntervalMs = Number(process.env.CRON_REFRESH_INTERVAL_MS || 30000);
    this.cronRefreshTimer = setInterval(() => {
      void this.refreshCrons().catch((error) => {
        console.error("[runtime] refreshCrons periodic failed", error);
      });
    }, Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0 ? refreshIntervalMs : 30000);

    void this.refreshCrons().catch((error) => {
      console.error("[runtime] refreshCrons initial failed", error);
    });

    if (typeof config?.registerShutdownTask === "function" && this.cronRefreshTimer) {
      config.registerShutdownTask("runtime:cron-refresh", async () => {
        clearInterval(this.cronRefreshTimer!);
      });
    }

    this._workflowCtors = ctors;
  }

  private _workflowCtors: Map<string, new (ctx: any, id?: string) => any>;

  async *startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent> {
    const Ctor = this._workflowCtors.get(workflowName);
    if (!Ctor) {
      yield { type: "failed", executionId: "", error: `Workflow "${workflowName}" not found` };
      return;
    }

    const id = crypto.randomUUID();
    yield { type: "started", executionId: id };

    const ctx = {
      runNode: async (workflowId: string, nodeName: string, fn: () => Promise<any>) => {
        return fn();
      },
      setStatus: (_wfId: string, _status: string) => {},
      getVar: (key: string) => undefined,
      setVar: (_key: string, _value: any) => {},
    };

    const wf = new Ctor(ctx, id);
    try {
      await wf.start(params);
      yield { type: "completed", executionId: id };
    } catch (e: any) {
      yield { type: "failed", executionId: id, error: e?.message ?? String(e) };
    }
  }

  async createExecution(workflowName: string, params: Record<string, any>): Promise<{ id: string }> {
    let executionId = "";
    (async () => {
      for await (const event of this.startExecution(workflowName, params)) {
        if (event.type === "started") executionId = event.executionId;
      }
    })().catch((e) => console.error(`[runtime] createExecution failed: ${e?.message}`));
    await new Promise<void>((resolve) => {
      const check = setInterval(() => { if (executionId) { clearInterval(check); resolve(); } }, 5);
    });
    return { id: executionId };
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
