import { readdir, readFile, writeFile, exists } from 'fs/promises';
import { join } from 'path';
import { MigrationState, Migration } from './types';

export class Migrator {
  constructor(private dir: string = './migrations') {}

  private async getState(): Promise<MigrationState> {
    const statePath = join(this.dir, 'state.json');
    
    if (await exists(statePath)) {
      const data = await readFile(statePath, 'utf-8');
      return JSON.parse(data);
    }
    
    return { executed: [] };
  }

  private async saveState(state: MigrationState): Promise<void> {
    const statePath = join(this.dir, 'state.json');
    await writeFile(statePath, JSON.stringify(state));
  }

  private async loadMigrations(): Promise<Migration[]> {
    const files = await readdir(this.dir);
    const migrations: Migration[] = [];

    for (const file of files.filter(f => f.endsWith('.ts') && !f.includes('state'))) {
      const module = await import(join(process.cwd(), this.dir, file));
      migrations.push(module.default);
    }

    return migrations.sort((a, b) => a.id.localeCompare(b.id));
  }

  async up(): Promise<void> {
    const state = await this.getState();
    const migrations = await this.loadMigrations();
    
    for (const migration of migrations) {
      if (!state.executed.includes(migration.id)) {
        await migration.up();
        state.executed.push(migration.id);
        await this.saveState(state);
      }
    }
  }

  async down(steps = 1): Promise<void> {
    const state = await this.getState();
    const migrations = await this.loadMigrations();
    
    for (let i = 0; i < steps && state.executed.length > 0; i++) {
      const lastId = state.executed.pop()!;
      const migration = migrations.find(m => m.id === lastId);
      
      if (migration) {
        await migration.down();
        await this.saveState(state);
      }
    }
  }
}