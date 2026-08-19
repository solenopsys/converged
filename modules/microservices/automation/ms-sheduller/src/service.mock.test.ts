import { beforeEach, describe, expect, mock, test } from "bun:test";

type CronEntry = {
  id: string;
  name: string;
  expression: string;
  provider: string;
  action: string;
  params?: Record<string, any>;
  providerSettings?: Record<string, any>;
  status: "active" | "paused";
  createdAt: string;
  updatedAt?: string;
};

class FakeCronsStoreService {
  private readonly items = new Map<string, CronEntry>();
  private seq = 1;

  create(input: any): CronEntry {
    const id = `cron-${this.seq++}`;
    const now = new Date().toISOString();
    const entry: CronEntry = {
      id,
      name: input.name,
      expression: input.expression,
      provider: input.provider,
      action: input.action,
      params: input.params,
      providerSettings: input.providerSettings,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(id, entry);
    return entry;
  }

  update(id: string, updates: any): CronEntry | null {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: CronEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  get(id: string): CronEntry | null {
    return this.items.get(id) ?? null;
  }

  list(params: any): { items: CronEntry[]; totalCount: number } {
    const status = params?.status;
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    let rows = Array.from(this.items.values());
    if (status) {
      rows = rows.filter((row) => row.status === status);
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items: limit === 0 ? [] : rows.slice(offset, offset + limit),
      totalCount: rows.length,
    };
  }
}

class FakeHistoryStoreService {
  private readonly items: any[] = [];
  private seq = 1;

  async record(entry: any): Promise<any> {
    const row = {
      id: `hist-${this.seq++}`,
      firedAt: new Date().toISOString(),
      ...entry,
    };
    this.items.push(row);
    return row;
  }

  async list(params: any): Promise<{ items: any[]; totalCount: number }> {
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    const cronId = params?.cronId;
    let rows = this.items.slice();
    if (cronId) {
      rows = rows.filter((row) => row.cronId === cronId);
    }
    rows.sort((a, b) => b.firedAt.localeCompare(a.firedAt));
    return {
      items: limit === 0 ? [] : rows.slice(offset, offset + limit),
      totalCount: rows.length,
    };
  }

  async getDailyRuns(_days = 30): Promise<any[]> {
    return [];
  }
}

class FakeStoresController {
  public crons = new FakeCronsStoreService();
  public history = new FakeHistoryStoreService();

  constructor(_msName: string) {}
  async init(): Promise<void> {}
}

mock.module("./stores", () => ({
  StoresController: FakeStoresController,
}));

import ShedullerServiceImpl from "./service";

describe("ShedullerServiceImpl with mocked stores", () => {
  beforeEach(() => {});

  test("recordHistory should persist history entry and expose it through listHistory/getStats", async () => {
    const service = new ShedullerServiceImpl();
    await service.init();

    const { id: cronId } = await service.createCron({
      name: "sync-cron",
      expression: "*/10 * * * *",
      provider: "dag",
      action: "runWorkflow",
      params: { workflowName: "wf.mock" },
      status: "active",
    });

    const history = await service.recordHistory({
      cronId,
      cronName: "sync-cron",
      provider: "dag",
      action: "runWorkflow",
      success: true,
      message: "execution done",
    });

    expect(history.id).toContain("hist-");
    expect(typeof history.firedAt).toBe("string");
    expect(history.cronId).toBe(cronId);

    const list = await service.listHistory({ offset: 0, limit: 10, cronId });
    expect(list.totalCount).toBe(1);
    expect(list.items[0].message).toBe("execution done");

    const stats = await service.getStats();
    expect(stats.history).toBe(1);
  });
});
