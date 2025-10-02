export interface LogEntry {
    timestamp: number;
    service: string;
    level: string;
    message: string;
    metadata?: any;
  }