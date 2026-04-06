import { SqlStore } from "back-core";
import type { UserModuleConfig } from "../../types";

interface UserConfigRow {
  userId: string;
  presets: string;
  additions: string;
  removals: string;
  updatedAt: string;
}

export class UsersStoreService {
  constructor(private store: SqlStore) {}

  async getConfig(userId: string): Promise<UserModuleConfig> {
    const row = await this.store.db
      .selectFrom("user_module_configs")
      .selectAll()
      .where("userId", "=", userId)
      .executeTakeFirst() as UserConfigRow | undefined;

    if (!row) return { presets: [], additions: [], removals: [] };

    return {
      presets: JSON.parse(row.presets),
      additions: JSON.parse(row.additions),
      removals: JSON.parse(row.removals),
    };
  }

  async saveConfig(userId: string, config: UserModuleConfig): Promise<void> {
    const now = new Date().toISOString();
    const row = {
      userId,
      presets: JSON.stringify(config.presets),
      additions: JSON.stringify(config.additions),
      removals: JSON.stringify(config.removals),
      updatedAt: now,
    };

    const existing = await this.store.db
      .selectFrom("user_module_configs")
      .select("userId")
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (existing) {
      await this.store.db
        .updateTable("user_module_configs")
        .set({ presets: row.presets, additions: row.additions, removals: row.removals, updatedAt: now })
        .where("userId", "=", userId)
        .execute();
    } else {
      await this.store.db
        .insertInto("user_module_configs")
        .values(row)
        .execute();
    }
  }

  async addModule(userId: string, moduleName: string): Promise<void> {
    const config = await this.getConfig(userId);
    if (!config.additions.includes(moduleName)) {
      config.additions.push(moduleName);
    }
    config.removals = config.removals.filter((m) => m !== moduleName);
    await this.saveConfig(userId, config);
  }

  async removeModule(userId: string, moduleName: string): Promise<void> {
    const config = await this.getConfig(userId);
    if (!config.removals.includes(moduleName)) {
      config.removals.push(moduleName);
    }
    config.additions = config.additions.filter((m) => m !== moduleName);
    await this.saveConfig(userId, config);
  }

  async linkPreset(userId: string, presetName: string): Promise<void> {
    const config = await this.getConfig(userId);
    if (!config.presets.includes(presetName)) {
      config.presets.push(presetName);
      await this.saveConfig(userId, config);
    }
  }

  async unlinkPreset(userId: string, presetName: string): Promise<void> {
    const config = await this.getConfig(userId);
    config.presets = config.presets.filter((p) => p !== presetName);
    await this.saveConfig(userId, config);
  }
}
