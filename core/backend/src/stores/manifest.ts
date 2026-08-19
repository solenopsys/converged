import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { StoreType } from "./types";
import { MigrationStateStorage, MigrationState } from "../migrations";

export type StoreManifest = {
  name: string;
  dataLocation: string;
  version: string;
  type: StoreType;
  migrations: string[];
}

export class ManifestStorage implements MigrationStateStorage {
  private filePath: string;

  constructor(
     parentDir: string
  ) {
    this.filePath = join(parentDir,   'manifest.json');
  }

  exists(): boolean {
    return existsSync(this.filePath);
  }

  async create(manifest: StoreManifest): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(manifest, null, 2));
  }

  async createIfNeeded(manifest: StoreManifest): Promise<void> {
    if (!this.exists()) {
      await this.create(manifest);
    }
  }

  async load(): Promise<StoreManifest> {
    const data = await readFile(this.filePath, 'utf-8');
    return JSON.parse(data);
  }

  async save(manifest: StoreManifest): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(manifest, null, 2));
  }

  async getState(): Promise<MigrationState> {
    const manifest = await this.load();
    return { executed: manifest.migrations };
  }

  async saveState(state: MigrationState): Promise<void> {
    const manifest = await this.load();
    manifest.migrations = state.executed;
    await this.save(manifest);
  }
}