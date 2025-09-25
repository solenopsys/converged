export interface Migration {
    id: string;
    up: () => Promise<void>;
    down: () => Promise<void>;
  }
  
  export interface MigrationState {
    executed: string[];
  }
  