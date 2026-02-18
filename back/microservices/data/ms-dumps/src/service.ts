import * as fs from "fs/promises";
import { existsSync, mkdirSync, type Dirent } from "fs";
import path from "path";
import { DATA_DIR } from "back-core";
import type {
  DumpFile,
  DumpsService,
  PaginationParams,
  PaginatedResult,
  StorageInfo,
} from "g-dumps";

export type DumpsConfig = {
  dbPath?: string;
  dumpDir?: string;
  baseUrl?: string;
};

const DOWNLOAD_PREFIX = "/services/dumps/download";
const DUMPS_MS_DIR = "dumps-ms";

export const resolveDumpsConfig = (config: DumpsConfig = {}) => {
  const baseDir = path.resolve(config.dbPath ?? DATA_DIR);
  const resolvedDumpDir = config.dumpDir
    ? path.resolve(config.dumpDir)
    : path.join(baseDir, DUMPS_MS_DIR);
  const dumpsDir = path.resolve(resolvedDumpDir);
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  return { baseDir, dumpsDir, baseUrl };
};

export const resolveDumpFilePath = (dumpsDir: string, fileName: string) => {
  const safeName = ensureSafeName(fileName);
  return path.join(dumpsDir, safeName);
};

const normalizeBaseUrl = (value?: string) => {
  if (!value) {
    return "";
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const ensureSafeName = (value: string) => {
  if (!value || value !== path.basename(value)) {
    throw new Error("Invalid name");
  }
  if (value.includes("..") || value.includes("/") || value.includes("\\")) {
    throw new Error("Invalid name");
  }
  return value;
};

const formatTimestamp = (date: Date) =>
  date.toISOString().replace(/[:.]/g, "-");

const directorySize = async (dir: string): Promise<number> => {
  let total = 0;
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return 0;
    }
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

const fileSize = async (filePath: string): Promise<number> => {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
};

const extractStorageName = (fileName: string) => {
  const base = fileName.replace(/\.gz$/i, "");
  const lastUnderscore = base.lastIndexOf("_");
  if (lastUnderscore <= 0) {
    return base;
  }
  return base.slice(0, lastUnderscore);
};

const runCommand = async (args: string[]) => {
  const proc = Bun.spawn(args, { stdout: "ignore", stderr: "pipe" });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = proc.stderr
      ? await new Response(proc.stderr).text()
      : "";
    const message = stderr.trim() || `Command failed (${exitCode})`;
    throw new Error(message);
  }
};

export class DumpsServiceImpl implements DumpsService {
  private baseDir: string;
  private dumpsDir: string;
  private baseUrl: string;

  constructor(config: DumpsConfig = {}) {
    const resolved = resolveDumpsConfig(config);
    this.baseDir = resolved.baseDir;
    this.dumpsDir = resolved.dumpsDir;
    this.baseUrl = resolved.baseUrl;
    mkdirSync(this.dumpsDir, { recursive: true });
  }

  async listStorages(): Promise<StorageInfo[]> {
    const storages = await this.getStorageDirectories();
    const results: StorageInfo[] = [];
    for (const storage of storages) {
      const size = await directorySize(storage.path);
      results.push({ name: storage.name, size });
    }
    return results;
  }

  async listDumps(
    params: PaginationParams,
  ): Promise<PaginatedResult<DumpFile>> {
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(this.dumpsDir, { withFileTypes: true });
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return { items: [], totalCount: 0 };
      }
      throw error;
    }

    const files = entries.filter((entry) => entry.isFile());
    const details = await Promise.all(
      files.map(async (entry) => {
        const filePath = path.join(this.dumpsDir, entry.name);
        const stat = await fs.stat(filePath);
        return {
          name: extractStorageName(entry.name),
          fileName: entry.name,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        };
      }),
    );

    details.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const offset = Math.max(0, params?.offset ?? 0);
    const limit = Math.max(0, params?.limit ?? details.length);
    const items = details
      .slice(offset, offset + limit)
      .map(({ mtimeMs, ...rest }) => rest);

    return {
      items,
      totalCount: details.length,
    };
  }

  async dump(name?: string): Promise<DumpFile[]> {
    const targets = name
      ? [await this.getStorageDirectory(name)]
      : await this.getStorageDirectories();

    const timestamp = formatTimestamp(new Date());
    const results: DumpFile[] = [];

    for (const storage of targets) {
      const fileName = `${storage.name}_${timestamp}.gz`;
      const outputPath = path.join(this.dumpsDir, fileName);
      await runCommand([
        "tar",
        "-czf",
        outputPath,
        "-C",
        this.baseDir,
        storage.name,
      ]);

      const size = await fileSize(outputPath);
      results.push({ name: storage.name, fileName, size });
    }

    return results;
  }

  async getLink(fileName: string): Promise<string> {
    const resolved = resolveDumpFilePath(this.dumpsDir, fileName);
    if (!existsSync(resolved)) {
      throw new Error("Dump not found");
    }
    const encoded = encodeURIComponent(fileName);
    return this.baseUrl
      ? `${this.baseUrl}${DOWNLOAD_PREFIX}/${encoded}`
      : `${DOWNLOAD_PREFIX}/${encoded}`;
  }

  private async getStorageDirectories(): Promise<
    Array<{ name: string; path: string }>
  > {
    if (!existsSync(this.baseDir)) {
      return [];
    }
    const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: path.join(this.baseDir, entry.name),
      }))
      .filter((entry) => !this.isDumpsDirectory(entry.path));
  }

  private async getStorageDirectory(name: string) {
    const safeName = ensureSafeName(name);
    const targetPath = path.join(this.baseDir, safeName);
    if (!existsSync(targetPath)) {
      throw new Error(`Storage not found: ${safeName}`);
    }
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      throw new Error(`Storage not found: ${safeName}`);
    }
    return { name: safeName, path: targetPath };
  }

  private isDumpsDirectory(storagePath: string) {
    return path.resolve(storagePath) === this.dumpsDir;
  }
}

export default DumpsServiceImpl;
