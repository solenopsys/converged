import { Cron } from "croner";
import type {
  ShedullerService,
  CronEntry,
  CronInput,
  CronUpdate,
  CronListParams,
  PaginatedResult,
  CronStatus,
  ProviderDefinition,
} from "./types";
import { StoresController } from "./stores";
import { getProviderDefinition, listProviderDefinitions } from "./providers";

const MS_ID = "sheduller-ms";

export class ShedullerServiceImpl implements ShedullerService {
  private stores!: StoresController;
  private jobs = new Map<string, Cron>();

  constructor() {
    this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
    this.rescheduleActive();
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

    const action = provider.actions.find((entry) => entry.name === input.action);
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
      // TODO: invoke provider action with entry.params and entry.providerSettings
    });
    this.jobs.set(entry.id, job);
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
