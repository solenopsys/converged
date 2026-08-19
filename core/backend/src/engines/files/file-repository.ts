import { FileStore, FileKey } from "./file-store";


export interface KeyFile {
  build(): FileKey;
}


export interface RepositoryFile<K extends KeyFile> {
  save(key: K, data: Uint8Array): Promise<void>;
  get(key: K): Promise<Uint8Array | undefined>;
  delete(key: K): Promise<boolean>;
  exists(key: K): boolean;
}


export class BaseRepositoryFile<
  K extends KeyFile,
> implements RepositoryFile<K> {
  constructor(protected store: FileStore) {}

  async save(key: K, data: Uint8Array): Promise<void> {
    await this.store.put(key.build(), data);
  }

  async get(key: K): Promise<Uint8Array | undefined> {
    return await this.store.read(key.build());
  }

  async delete(key: K): Promise<boolean> {
    return await this.store.delete(key.build());
  }

  exists(key: K): boolean {
    return this.store.exists(key.build());
  }
}
