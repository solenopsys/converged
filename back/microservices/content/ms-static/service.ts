import { StoresController } from "./store";
import type {
  FlushResult,
  ListMetaParams,
  SetDataParams,
  SetMetaParams,
  SetStatusPatternParams,
  SetStatusPatternResult,
  StaticMeta,
  StaticMetaListResult,
  StaticService,
  StaticStatus,
} from "./types";

const MS_ID = "static-ms";

function ensureId(id: string): void {
  if (!id || !id.trim()) {
    const error: any = new Error("id is empty");
    error.statusCode = 400;
    throw error;
  }
}

class StaticServiceImpl implements StaticService {
  stores!: StoresController;
  private readonly initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  private async ensureInit(): Promise<void> {
    await this.initPromise;
  }

  async getData(id: string): Promise<string | null> {
    await this.ensureInit();
    ensureId(id);
    return this.stores.content.getData(id);
  }

  async setData(params: SetDataParams): Promise<StaticMeta> {
    await this.ensureInit();
    ensureId(params.id);

    if (typeof params.content !== "string") {
      const error: any = new Error("content must be a string");
      error.statusCode = 400;
      throw error;
    }

    this.stores.content.setData(params.id, params.content);
    return this.stores.meta.setLoaded(params);
  }

  async setMeta(params: SetMetaParams): Promise<StaticMeta> {
    await this.ensureInit();
    ensureId(params.id);
    return this.stores.meta.setMeta(params);
  }

  async getMeta(id: string): Promise<StaticMeta | null> {
    await this.ensureInit();
    ensureId(id);
    return this.stores.meta.getMeta(id);
  }

  async listMeta(params: ListMetaParams): Promise<StaticMetaListResult> {
    await this.ensureInit();
    return this.stores.meta.listMeta(params);
  }

  async getOneByStatus(status: StaticStatus): Promise<StaticMeta | null> {
    await this.ensureInit();
    return this.stores.meta.getOneByStatus(status);
  }

  async setStatus(id: string, status: StaticStatus): Promise<StaticMeta> {
    await this.ensureInit();
    ensureId(id);
    return this.stores.meta.setStatus(id, status);
  }

  async setStatusPattern(params: SetStatusPatternParams): Promise<SetStatusPatternResult> {
    await this.ensureInit();
    return this.stores.meta.setStatusPattern(params);
  }

  async deleteMeta(id: string): Promise<void> {
    await this.ensureInit();
    ensureId(id);
    await this.stores.meta.deleteMeta(id);
  }

  async deleteEntry(id: string): Promise<void> {
    await this.ensureInit();
    ensureId(id);
    this.stores.content.deleteData(id);
    await this.stores.meta.deleteMeta(id);
  }

  async flush(): Promise<FlushResult> {
    await this.ensureInit();
    const ids = await this.stores.meta.listIds();
    let removed = 0;

    for (const key of this.stores.content.listKeys()) {
      if (!ids.has(key)) {
        this.stores.content.deleteData(key);
        removed += 1;
      }
    }

    return { removed };
  }
}

export default StaticServiceImpl;
