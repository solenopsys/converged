import { SqlStore } from "back-core";

export interface NodeEntity {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
}

export class SqlStoreService {
  private db: SqlStore["db"];

  constructor(store: SqlStore) {
    this.db = store.db;
  }

  async addNode(node: NodeEntity): Promise<void> {
    await this.db.insertInto("nodes").values(node).execute();
  }

  async getNode(id: string): Promise<NodeEntity | undefined> {
    return this.db.selectFrom("nodes").selectAll().where("id", "=", id).executeTakeFirst() as Promise<NodeEntity | undefined>;
  }

  async getChildren(parentId: string): Promise<NodeEntity[]> {
    return this.db.selectFrom("nodes").selectAll().where("parentId", "=", parentId).execute() as Promise<NodeEntity[]>;
  }

  async listRoots(): Promise<NodeEntity[]> {
    return this.db.selectFrom("nodes").selectAll().where("parentId", "is", null).execute() as Promise<NodeEntity[]>;
  }
}
