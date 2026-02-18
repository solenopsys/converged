import {
  MarkdownService,
  MdFile,
  PaginatedResult,
  PaginationParams,
} from "g-markdown";
import { mdToJson } from "bun-md4c";
import { StoresController } from "./stores";

const MS_ID = "markdown-ms";

export class MarkdownServiceImpl implements MarkdownService {
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

  async saveMd(mdFile: MdFile): Promise<string> {
    const data = new TextEncoder().encode(mdFile.content);
    await this.stores.fileStore.put(mdFile.path, data);
    return mdFile.path;
  }

  async readMd(filePath: string): Promise<MdFile> {
    const data = await this.stores.fileStore.get(filePath);
    if (!data) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = new TextDecoder().decode(data);
    return {
      path: filePath,
      content,
    };
  }

  async readMdJson(filePath: string): Promise<any> {
    const mdFile = await this.readMd(filePath);
    const ast = mdToJson(mdFile.content);
    return {
      path: mdFile.path,
      content: ast,
    };
  }

  async readMdJsonBatch(paths: string[]): Promise<any[]> {
    return Promise.all(paths.map((p) => this.readMdJson(p)));
  }

  async listOfMd(params: PaginationParams): Promise<PaginatedResult<MdFile>> {
    const allKeys = await this.stores.fileStore.listKeys();
    const mdKeys = allKeys.filter((k) => k.endsWith(".md"));

    const start = params.offset;
    const end = params.offset + params.limit;
    const items: MdFile[] = [];

    for (let i = start; i < end && i < mdKeys.length; i++) {
      const data = await this.stores.fileStore.get(mdKeys[i]);
      if (data) {
        items.push({
          path: mdKeys[i],
          content: new TextDecoder().decode(data),
        });
      }
    }

    return {
      items,
      totalCount: mdKeys.length,
    };
  }
}
