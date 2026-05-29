import { BaseService, badRequestError } from "back-core";
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

function ensureId(id: string): void {
  if (!id || !id.trim()) {
    throw badRequestError("id is empty");
  }
}

class StaticServiceImpl extends BaseService<StoresController> implements StaticService {
  constructor() {
    super("static-ms");
  }

  protected createStores(msId: string): StoresController {
    return new StoresController(msId);
  }

  async getData(id: string): Promise<string | null> {
    await this.ready();
    ensureId(id);
    return this.stores.content.getData(id);
  }

  async setData(params: SetDataParams): Promise<StaticMeta> {
    await this.ready();
    ensureId(params.id);

    if (typeof params.content !== "string") {
      throw badRequestError("content must be a string");
    }

    this.stores.content.setData(params.id, params.content);
    return this.stores.meta.setLoaded(params);
  }

  async setMeta(params: SetMetaParams): Promise<StaticMeta> {
    await this.ready();
    ensureId(params.id);
    return this.stores.meta.setMeta(params);
  }

  async getMeta(id: string): Promise<StaticMeta | null> {
    await this.ready();
    ensureId(id);
    return this.stores.meta.getMeta(id);
  }

  async listMeta(params: ListMetaParams): Promise<StaticMetaListResult> {
    await this.ready();
    return this.stores.meta.listMeta(params);
  }

  async getOneByStatus(status: StaticStatus): Promise<StaticMeta | null> {
    await this.ready();
    return this.stores.meta.getOneByStatus(status);
  }

  async setStatus(id: string, status: StaticStatus): Promise<StaticMeta> {
    await this.ready();
    ensureId(id);
    return this.stores.meta.setStatus(id, status);
  }

  async setStatusPattern(params: SetStatusPatternParams): Promise<SetStatusPatternResult> {
    await this.ready();
    return this.stores.meta.setStatusPattern(params);
  }

  async deleteMeta(id: string): Promise<void> {
    await this.ready();
    ensureId(id);
    await this.stores.meta.deleteMeta(id);
  }

  async deleteEntry(id: string): Promise<void> {
    await this.ready();
    ensureId(id);
    this.stores.content.deleteData(id);
    await this.stores.meta.deleteMeta(id);
  }

  async flush(): Promise<FlushResult> {
    await this.ready();
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
