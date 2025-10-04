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