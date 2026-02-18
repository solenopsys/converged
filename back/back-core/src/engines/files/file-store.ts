import * as fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";
import { Store } from "../../stores";
import { Migration, Migrator, MigrationStateStorage } from "../../migrations";

export type FileKey = string;

/**
 * FileStore - файловое key-value хранилище
 * Ключ - относительный путь файла (может содержать поддиректории)
 */
export class FileStore implements Store {
  private basePath: string;

  constructor(
    private dataLocation: string,
    private migrations: (new (store: Store) => Migration)[],
    private migrationsState: MigrationStateStorage,
  ) {
    // dataLocation это путь к директории хранилища
    this.basePath = dataLocation;
  }

  async open(): Promise<void> {
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  async close(): Promise<void> {
    // Для файлового хранилища закрытие не требуется
  }

  async migrate(): Promise<void> {
    const migrations = this.migrations.map((migration) => new migration(this));
    const migrator = new Migrator(migrations, this.migrationsState);
    await migrator.up();
  }

  /**
   * Получить полный путь к файлу по ключу
   */
  private getFilePath(key: FileKey): string {
    return path.join(this.basePath, key);
  }

  /**
   * Сохранить данные по ключу
   */
  async put(key: FileKey, data: Uint8Array): Promise<void> {
    const filePath = this.getFilePath(key);
    const dirPath = path.dirname(filePath);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    await fs.writeFile(filePath, data);
  }

  /**
   * Получить данные по ключу
   */
  async get(key: FileKey): Promise<Uint8Array | undefined> {
    const filePath = this.getFilePath(key);
    try {
      const data = await fs.readFile(filePath);
      return new Uint8Array(data);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return undefined;
      }
      throw err;
    }
  }

  /**
   * Проверить существование по ключу
   */
  exists(key: FileKey): boolean {
    return existsSync(this.getFilePath(key));
  }

  /**
   * Удалить данные по ключу
   */
  async delete(key: FileKey): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }

  /**
   * Получить список всех ключей
   */
  async listKeys(): Promise<FileKey[]> {
    if (!existsSync(this.basePath)) {
      return [];
    }

    return this.collectKeys(this.basePath);
  }

  /**
   * Получить статистику хранилища
   */
  async getStats(): Promise<FileStoreStats> {
    let totalFiles = 0;
    let totalSize = 0;
    const prefixStats: Record<string, { count: number; size: number }> = {};

    try {
      if (!existsSync(this.basePath)) {
        return {
          totalFiles,
          totalSize,
          prefixStats,
          basePath: this.basePath,
        };
      }

      const entries = await this.collectFileStats(this.basePath);
      for (const entry of entries) {
        totalFiles += 1;
        totalSize += entry.size;
        const prefix = entry.prefix;
        if (!prefixStats[prefix]) {
          prefixStats[prefix] = { count: 0, size: 0 };
        }
        prefixStats[prefix].count += 1;
        prefixStats[prefix].size += entry.size;
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    return {
      totalFiles,
      totalSize,
      prefixStats,
      basePath: this.basePath,
    };
  }

  private async collectKeys(dir: string): Promise<FileKey[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const keys: FileKey[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.collectKeys(fullPath);
        keys.push(...nested);
      } else if (entry.isFile()) {
        const relativePath = path.relative(this.basePath, fullPath);
        keys.push(relativePath);
      }
    }

    return keys;
  }

  private async collectFileStats(
    dir: string,
  ): Promise<Array<{ size: number; prefix: string }>> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const stats: Array<{ size: number; prefix: string }> = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.collectFileStats(fullPath);
        stats.push(...nested);
      } else if (entry.isFile()) {
        const fileStat = await fs.stat(fullPath);
        const relativePath = path.relative(this.basePath, fullPath);
        const segments = relativePath.split(path.sep);
        const prefix = segments.length > 1 ? segments[0] : ".";
        stats.push({ size: fileStat.size, prefix });
      }
    }

    return stats;
  }
}

export interface FileStoreStats {
  totalFiles: number;
  totalSize: number;
  prefixStats: Record<string, { count: number; size: number }>;
  basePath: string;
}
