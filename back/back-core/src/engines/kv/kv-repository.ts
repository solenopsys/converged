import { KVStore } from "./kv-store";
import { KeyKV, RepositoryKV, RepositorySchema } from "./kv-types";

/**
 * Базовый репозиторий для KV хранилища
 */
export class BaseRepositoryKV<K extends KeyKV, V> implements RepositoryKV<K, V> {
  constructor(
    protected store: KVStore,
    protected schema: RepositorySchema<K, V>,
  ) {}

  save(key: K, value: V): string {
    return this.store.put(key.build(), value);
  }

  get(key: K): V | undefined {
    return this.store.get(key.build()) as V;
  }

  getDirect(key: string): V | undefined {
    return this.store.getDirect(key) as V;
  }

  delete(key: K): void {
    this.store.delete(key.build());
  }

  listKeys(): string[] {
    return this.store.listKeys(this.schema.prefix);
  }

  listValues(): V[] {
    return this.store.getValuesRangeAsArrayByPrefixChain(this.schema.prefix) as V[];
  }

  listKeysByPrefix(prefix: string[]): string[] {
    return this.store.listKeys([...this.schema.prefix, ...prefix]);
  }

  listValuesByPrefix(prefix: string[]): V[] {
    return this.store.getValuesRangeAsArrayByPrefixChain([...this.schema.prefix, ...prefix]) as V[];
  }
}

/**
 * Репозиторий с префиксом для KV хранилища
 */
export abstract class PrefixedRepositoryKV<K extends KeyKV, V> implements RepositoryKV<K, V> {
  constructor(protected db: KVStore) {}

  abstract getPrefix(): string[];

  save(key: K, value: V): string {
    return this.db.put(key.build(), value);
  }

  get(key: K): V | undefined {
    return this.db.get(key.build()) as V;
  }

  getDirect(key: string): V | undefined {
    return this.db.getDirect(key) as V;
  }

  delete(key: K): void {
    this.db.delete(key.build());
  }

  listKeys(): string[] {
    return this.db.listKeys(this.getPrefix());
  }

  listValues(): V[] {
    return this.db.getValuesRangeAsArrayByPrefixChain(this.getPrefix()) as V[];
  }

  listKeysByPrefix(prefix: string[]): string[] {
    return this.db.listKeys([...this.getPrefix(), ...prefix]);
  }

  listValuesByPrefix(prefix: string[]): V[] {
    return this.db.getValuesRangeAsArrayByPrefixChain([...this.getPrefix(), ...prefix]) as V[];
  }
}

/**
 * Репозиторий с версионированием
 */
export abstract class VersionedRepositoryKV<K extends KeyKV, V> extends PrefixedRepositoryKV<K, V> {
  getVersionsKeys(name: string): string[] {
    return this.db.listKeys([...this.getPrefix(), name]);
  }

  getVersions(name: string): V[] {
    const versions: V[] = [];
    const keys = this.getVersionsKeys(name);
    for (const key of keys) {
      const version = key.split(":")[2];
      const value = this.db.get([...this.getPrefix(), name, version]);
      versions.push(value);
    }
    return versions;
  }

  getLastVersion(name: string): string | undefined {
    const keys = this.getVersionsKeys(name);
    if (keys.length === 0) {
      return undefined;
    }
    return keys[keys.length - 1];
  }
}
