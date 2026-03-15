import { randomUUID } from "node:crypto";
import type { ClassifierService, ClassifierNode } from "./types";
import { StoresController } from "./store";

const MS_ID = "classifier-ms";

class ClassifierServiceImpl implements ClassifierService {
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

  async addNode(node: Omit<ClassifierNode, "id"> & { id?: string }): Promise<string> {
    await this.ensureInit();
    const id = node.id || randomUUID();
    await this.stores.sqlStoreService.addNode({
      id,
      parentId: node.parentId ?? null,
      name: node.name,
      slug: node.slug,
    });
    return id;
  }

  async getNode(id: string): Promise<ClassifierNode | null> {
    await this.ensureInit();
    const entity = await this.stores.sqlStoreService.getNode(id);
    if (!entity) return null;
    return { id: entity.id, parentId: entity.parentId, name: entity.name, slug: entity.slug };
  }

  async getChildren(parentId: string): Promise<ClassifierNode[]> {
    await this.ensureInit();
    const entities = await this.stores.sqlStoreService.getChildren(parentId);
    return entities.map((e) => ({ id: e.id, parentId: e.parentId, name: e.name, slug: e.slug }));
  }

  async listRoots(): Promise<ClassifierNode[]> {
    await this.ensureInit();
    const entities = await this.stores.sqlStoreService.listRoots();
    return entities.map((e) => ({ id: e.id, parentId: e.parentId, name: e.name, slug: e.slug }));
  }
}

export default ClassifierServiceImpl;
