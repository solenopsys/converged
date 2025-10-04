import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { StoreType } from "./types";

export  type StoreManifest = {
  name: string;
  dataLocation: string;
  version: string;
  type: StoreType;
  migrations: string[];
}

export interface MigrationState {
  executed: string[];
}

export interface MigrationStateStorage {
  getState(): Promise<MigrationState>;
  saveState(state: MigrationState): Promise<void>;
}

// Создает новый манифест
export async function createOrLoadManifest(parentDir: string, manifest: StoreManifest): Promise<string> {
  const dir = join(parentDir, manifest.name);
  if (existsSync(dir)) {
    return dir;
  }
  await mkdir(dir, { recursive: true });
  
  const manifestPath = join(dir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  return dir;
}

// Работает с существующим манифестом
export class ManifestStorage implements MigrationStateStorage {
  private filePath: string;

  constructor(
    private parentDir: string,
    private storeName: string
  ) {
    this.filePath = join(parentDir, storeName, 'manifest.json');
  }

  async getManifest(): Promise<StoreManifest> {
    const data = await readFile(this.filePath, 'utf-8');
    return JSON.parse(data);
  }

  async getState(): Promise<MigrationState> {
    const manifest = await this.getManifest();
    return { executed: manifest.migrations };
  }

  async saveState(state: MigrationState): Promise<void> {
    const manifest = await this.getManifest();
    manifest.migrations = state.executed;
    await writeFile(this.filePath, JSON.stringify(manifest, null, 2));
  }
}