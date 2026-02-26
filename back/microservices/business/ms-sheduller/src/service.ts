import { Cron } from "croner";
import { DagServiceImpl } from "ms-dag";
import type {
  ShedullerService,
  CronEntry,
  CronInput,
  CronUpdate,
  CronListParams,
  CronHistoryEntry,
  CronHistoryListParams,
  PaginatedResult,
  CronStatus,
  ProviderDefinition,
  ShedullerStats,
} from "./types";
import { StoresController } from "./stores";
import { getProviderDefinition, listProviderDefinitions } from "./providers";

const MS_ID = "sheduller-ms";

export class ShedullerServiceImpl implements ShedullerService {
  private stores!: StoresController;
  private initPromise?: Promise<void>;
  private jobs = new Map<string, Cron>();
  private dagService: DagServiceImpl;

  constructor(options?: any) {
    this.dagService = new DagServiceImpl(options);
    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
      this.rescheduleActive();
    })();

    return this.initPromise;
  }

  createCron(input: CronInput): Promise<{ id: string }> {
    this.assertInput(input);
    const entry = this.stores.crons.create(input);
    this.syncJob(entry);
    return Promise.resolve({ id: entry.id });
  }

  updateCron(id: string, updates: CronUpdate): Promise<CronEntry | null> {
    if (!id) {
      throw new Error("id is required");
    }
    const updated = this.stores.crons.update(id, updates);
    if (!updated) {
      return Promise.resolve(null);
    }
    this.syncJob(updated);
    return Promise.resolve(updated);
  }

  deleteCron(id: string): Promise<boolean> {
    if (!id) {
      throw new Error("id is required");
    }
    const removed = this.stores.crons.delete(id);
    if (removed) {
      this.unschedule(id);
    }
    return Promise.resolve(removed);
  }

  getCron(id: string): Promise<CronEntry | null> {
    if (!id) {
      throw new Error("id is required");
    }
    return Promise.resolve(this.stores.crons.get(id));
  }

  listCrons(params: CronListParams): Promise<PaginatedResult<CronEntry>> {
    return Promise.resolve(this.stores.crons.list(params));
  }

  listProviders(): Promise<ProviderDefinition[]> {
    return Promise.resolve(listProviderDefinitions());
  }

  listHistory(params: CronHistoryListParams): Promise<PaginatedResult<CronHistoryEntry>> {
    return Promise.resolve(this.stores.history.list(params));
  }

  getStats(): Promise<ShedullerStats> {
    const crons = this.stores.crons.list({ offset: 0, limit: 0 });
    const history = this.stores.history.list({ offset: 0, limit: 0 });
    return Promise.resolve({
      crons: crons.totalCount ?? 0,
      history: history.totalCount ?? 0,
    });
  }

  private assertInput(input: CronInput) {
    if (!input?.name || !input?.expression || !input?.provider || !input?.action) {
      const error: any = new Error("name, expression, provider and action are required");
      error.statusCode = 400;
      throw error;
    }

    const provider = getProviderDefinition(input.provider);
    if (!provider) {
      const error: any = new Error(`Unknown provider: ${input.provider}`);
      error.statusCode = 400;
      throw error;
    }

    const action = provider.actions.includes(input.action);
    if (!action) {
      const error: any = new Error(`Unknown action: ${input.action}`);
      error.statusCode = 400;
      throw error;
    }
  }

  private syncJob(entry: CronEntry) {
    if (entry.status === "active") {
      this.schedule(entry);
    } else {
      this.unschedule(entry.id);
    }
  }

  private schedule(entry: CronEntry) {
    this.unschedule(entry.id);
    const job = new Cron(entry.expression, () => {
      this.invokeProvider(entry);
    });
    this.jobs.set(entry.id, job);
  }

  private async invokeProvider(entry: CronEntry) {
    let success = true;
    let message: string | undefined = undefined;

    try {
      if (entry.provider === "log") {
        message = entry.params?.message ?? "";
        const parts = [`[sheduller] cron fired: id=${entry.id} name="${entry.name}"`];
        if (message) parts.push(`message="${message}"`);
        console.log(parts.join(" "));
      } else if (entry.provider === "dag" && entry.action === "runWorkflow") {
        if (!this.dagService) throw new Error("dag provider: dagService not configured");
        const workflowName = entry.params?.workflowName;
        const params = entry.params?.params ?? {};
        if (!workflowName) throw new Error("dag provider: workflowName is required in params");
        for await (const event of this.dagService.startExecution(workflowName, params)) {
          if (event.type === "failed") throw new Error(event.error ?? "dag workflow failed");
          if (event.type === "completed") { message = `execution ${event.executionId} completed`; break; }
        }
      }
    } catch (err: any) {
      success = false;
      message = err?.message ?? String(err);
      console.error(`[sheduller] provider error: id=${entry.id} name="${entry.name}"`, err);
    }

    this.stores.history.record({
      cronId: entry.id,
      cronName: entry.name,
      provider: entry.provider,
      action: entry.action,
      success,
      message,
    });
  }

  private unschedule(id: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
    }
  }

  private rescheduleActive() {
    const list = this.stores.crons.list({ offset: 0, limit: 10000 });
    for (const entry of list.items) {
      if (entry.status === "active") {
        this.schedule(entry);
      }
    }
  }
}

export default ShedullerServiceImpl;
