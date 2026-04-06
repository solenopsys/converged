import { JsonStore } from "./json-store";

export interface KeyJson {
  readonly type: string;
  readonly key: string;
  build(): string; // returns "{type}/{key}"
}

export abstract class BaseKeyJson implements KeyJson {
  abstract readonly type: string;
  constructor(readonly key: string) {}
  build(): string {
    return `${this.type}/${this.key}`;
  }
}

export class BaseRepositoryJson<K extends KeyJson, V> {
  constructor(protected store: JsonStore) {}

  async save(key: K, value: V): Promise<void> {
    await this.store.putJson(key.build(), value);
  }

  async get(key: K): Promise<V | undefined> {
    return this.store.getJson<V>(key.build());
  }

  async delete(key: K): Promise<boolean> {
    return this.store.deleteJson(key.build());
  }

  exists(key: K): boolean {
    return this.store.existsJson(key.build());
  }

  async listKeys(): Promise<string[]> {
    return this.store.listJsonKeys();
  }

  async listAll(): Promise<V[]> {
    return this.store.listAllJson<V>();
  }
}
