 
import { LogEntry } from './types';

import { open } from 'lmdb';

export class Storage {
  private db;
  
  constructor() {
    this.db = open('./data/cache', {});
  }
  
  store(log: LogEntry) {
    const key = `${Date.now()}_${Math.random()}`;
    this.db.put(key, log);
  }
  
  getAll(): LogEntry[] {
    const logs = [];
    for (const { value } of this.db.getRange()) {
      logs.push(value);
    }
    return logs;
  }
  
  clear() {
    this.db.clearSync();
  }
}