import { JsonStore, type Migration, type Store } from "back-core";

export default class MoveFlatCronsToCronPrefix implements Migration {
  id = "move_flat_crons_to_cron_prefix";
  private readonly store: JsonStore;

  constructor(store: Store) {
    this.store = store as JsonStore;
  }

  async up(): Promise<void> {
    const keys = await this.store.listJsonKeys();
    for (const key of keys) {
      if (key.includes("/")) continue;

      const value = await this.store.getJson<unknown>(key);
      if (value === undefined) continue;

      const prefixedKey = `cron/${key}`;
      if (!this.store.existsJson(prefixedKey)) {
        await this.store.putJson(prefixedKey, value);
      }
      await this.store.deleteJson(key);
    }
  }

  async down(): Promise<void> {
    const keys = await this.store.listJsonKeys();
    for (const key of keys) {
      if (!key.startsWith("cron/")) continue;

      const flatKey = key.slice("cron/".length);
      if (!flatKey || flatKey.includes("/")) continue;

      const value = await this.store.getJson<unknown>(key);
      if (value === undefined) continue;

      if (!this.store.existsJson(flatKey)) {
        await this.store.putJson(flatKey, value);
      }
      await this.store.deleteJson(key);
    }
  }
}
