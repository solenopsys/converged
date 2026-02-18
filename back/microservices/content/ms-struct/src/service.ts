import {
  StructService,
  PaginatedResult,
  PaginationParams,
} from "g-struct";
import { StoresController } from "./stores";

const MS_ID = "struct-ms";

export class StructServiceImpl implements StructService {
  stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  async saveJson(path: string, data: any): Promise<string> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    await this.stores.fileStore.put(path, bytes);
    return path;
  }

  async readJson(path: string): Promise<any> {
    const data = await this.stores.fileStore.get(path);
    if (!data) {
      throw new Error(`File not found: ${path}`);
    }
    const json = new TextDecoder().decode(data);
    return JSON.parse(json);
  }

  async readJsonBatch(paths: string[]): Promise<any[]> {
    return Promise.all(paths.map((p) => this.readJson(p)));
  }

  async deleteJson(path: string): Promise<void> {
    await this.stores.fileStore.delete(path);
  }

  async listJson(params: PaginationParams): Promise<PaginatedResult<string>> {
    const allKeys = await this.stores.fileStore.listKeys();
    const jsonKeys = allKeys.filter((k) => k.endsWith(".json"));

    const start = params.offset;
    const end = params.offset + params.limit;

    return {
      items: jsonKeys.slice(start, end),
      totalCount: jsonKeys.length,
    };
  }
}
