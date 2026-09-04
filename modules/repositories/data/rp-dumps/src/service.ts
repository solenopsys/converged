import * as fs from "fs/promises";
import { existsSync, type Dirent } from "fs";
import path from "path";
import { DATA_DIR, getStorageConnection } from "back-core";

const MAX_SEGMENT = 1024 * 1024; // 1 MB

export type DumpsConfig = {};

// Filesystem-based recursive directory size (for listing, no need to open store)
const directorySize = async (dir: string): Promise<number> => {
  let total = 0;
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(fullPath);
    } else if (entry.isFile()) {
      const stat = await fs.stat(fullPath);
      total += stat.size;
    }
  }
  return total;
};

export class DumpsServiceImpl {
  private baseDir: string;

  constructor(_config: DumpsConfig = {}) {
    this.baseDir = path.resolve(DATA_DIR);
  }

  async listStorages(): Promise<Array<{ name: string; size: number }>> {
    if (!existsSync(this.baseDir)) return [];

    const results: Array<{ name: string; size: number }> = [];
    const topEntries = await fs.readdir(this.baseDir, { withFileTypes: true });

    for (const top of topEntries) {
      if (!top.isDirectory()) continue;
      const topPath = path.join(this.baseDir, top.name);
      const subEntries = await fs.readdir(topPath, { withFileTypes: true });
      for (const sub of subEntries) {
        if (!sub.isDirectory()) continue;
        const storePath = path.join(topPath, sub.name);
        const name = `${top.name}/${sub.name}`;
        const size = await directorySize(storePath);
        results.push({ name, size });
      }
    }
    return results;
  }

  async storageStats() {
    const storages = await this.listStorages();
    const totalSize = storages.reduce((sum, s) => sum + s.size, 0);
    return { totalSize, storageCount: storages.length, storages };
  }

  async compact(name: string) {
    const slashIdx = name.indexOf("/");
    if (slashIdx <= 0) throw new Error("Invalid storage name, expected ms/store");
    const ms = name.slice(0, slashIdx);
    const store = name.slice(slashIdx + 1);
    getStorageConnection().kvCompact(ms, store);
    return { name };
  }

  async createDump(name: string) {
    const [ms, store] = name.split("/");
    if (!ms || !store) throw new Error("Invalid storage name, expected ms/store");
    const fileName = getStorageConnection().dumpCreate(ms, store);
    return { name, fileName };
  }

  async listDumps() {
    const dumps = getStorageConnection().dumpList();
    return dumps.map(d => ({
      name: d.name,
      size: Number(d.size),
    }));
  }

  async deleteDump(fileName: string) {
    getStorageConnection().dumpDelete(fileName);
  }

  async getDumpSize(fileName: string): Promise<number> {
    const dumps = getStorageConnection().dumpList();
    const found = dumps.find(d => d.name === fileName);
    if (!found) throw new Error("Dump not found");
    return Number(found.size);
  }

  readDumpSegment(fileName: string, offset: bigint, length: number): Buffer {
    return getStorageConnection().dumpRead(fileName, offset, Math.min(length, MAX_SEGMENT));
  }
}

export default DumpsServiceImpl;
