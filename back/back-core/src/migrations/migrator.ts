
import { Migration, MigrationStateStorage } from "./types";

export class Migrator {
  constructor(
    private migrations: Migration[],
    private storage: MigrationStateStorage
  ) {}

  async up(): Promise<void> {
    const state = await this.storage.getState();
    
    for (const migration of this.migrations) {
      if (!state.executed.includes(migration.id)) {
        await migration.up();
        state.executed.push(migration.id);
        await this.storage.saveState(state);
      }
    }
  }

  async down(steps = 1): Promise<void> {
    const state = await this.storage.getState();
    
    for (let i = 0; i < steps && state.executed.length > 0; i++) {
      const lastId = state.executed.pop()!;
      const migration = this.migrations.find(m => m.id === lastId);
      
      if (migration) {
        await migration.down();
        await this.storage.saveState(state);
      }
    }
  }
}



