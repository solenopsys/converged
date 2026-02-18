export interface Migration {
  id: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export interface MigrationState {
  executed: string[];
}

export interface MigrationStateStorage {
  getState(): Promise<MigrationState>;
  saveState(state: MigrationState): Promise<void>;
}

/**
 * In-memory implementation of MigrationStateStorage for testing
 */
export class InMemoryMigrationState implements MigrationStateStorage {
  private state: MigrationState = { executed: [] };

  async getState(): Promise<MigrationState> {
    return this.state;
  }

  async saveState(state: MigrationState): Promise<void> {
    this.state = state;
  }
}
