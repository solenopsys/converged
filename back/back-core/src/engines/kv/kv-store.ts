import { Database } from "bun-lmdbx";
import {
  KEY_SEPARATOR,
  RANGE_END_SUFFIX,
  RANGE_START_SUFFIX,
} from "../../utils";
import { Store } from "../../stores";
import { Migration, Migrator } from "../../migrations";
import { MigrationStateStorage } from "../../migrations";

const HEADER_JSON = Buffer.from("KVJ0");
const HEADER_BUFFER = Buffer.from("KVB0");
const HEADER_LENGTH = HEADER_JSON.length;

export interface KVStoreIntf {
  get(key: string[]): any | undefined;
  put(key: string[], value: any): string;
  delete(key: string[]): void;
  listKeys(prefix: string[]): string[];
}

export class KVStore implements KVStoreIntf, Store {
  public db!: Database;

  constructor(
    private dataLocation: string,
    private migrations: (new (store: Store) => Migration)[],
    private migrationsState: MigrationStateStorage,
  ) {}

  listKeys(prefix: string[]): string[] {
    return this.getKeysWithPrefix(prefix);
  }

  async open() {
    this.db = new Database(this.dataLocation);
  }

  getKeysWithPrefix(prefixChain: string[]): string[] {
    const prefix = prefixChain.join(KEY_SEPARATOR);
    return this.getKeysWithRange(
      prefix + RANGE_START_SUFFIX,
      prefix + RANGE_END_SUFFIX,
    );
  }

  getVeluesRangeAsObjectWithPrefix(prefixChain: string): {
    [key: string]: any;
  } {
    const prefix = prefixChain;
    return this.getVeluesRangeAsObject(
      prefix + RANGE_START_SUFFIX,
      prefix + RANGE_END_SUFFIX,
    );
  }

  getKeysWithRange(start: string, end: string): string[] {
    const keys: string[] = [];
    const range = this.db.getRange({ start, end });
    for (const { key } of range) {
      const keyString = key.toString();
      if (!this.isWithinRange(keyString, start, end)) {
        if (end && keyString > end) break;
        continue;
      }
      keys.push(keyString);
    }
    return keys;
  }

  getVeluesRangeAsObject(start: string, end: string): { [key: string]: any } {
    const keys: { [key: string]: any } = {};
    const range = this.db.getRange({ start, end });

    for (const { key, value } of range) {
      const keyString = key.toString();
      if (!this.isWithinRange(keyString, start, end)) {
        if (end && keyString > end) break;
        continue;
      }
      const parts = keyString.split(KEY_SEPARATOR);
      const lastSegment = parts[parts.length - 1];
      keys[lastSegment] = this.deserializeValue(value);
    }
    return keys;
  }

  getValuesRangeAsArrayByPrefixChain(prefixChain: string[]): any[] {
    return this.getValuesRangeAsArrayByPrefix(prefixChain.join(KEY_SEPARATOR));
  }

  getValuesRangeAsArrayByPrefix(prefixChain: string): any[] {
    return this.getValuesRangeAsArrayByRange(
      prefixChain + RANGE_START_SUFFIX,
      prefixChain + RANGE_END_SUFFIX,
    );
  }

  getValuesRangeAsArrayByRange(start: string, end: string): any[] {
    const values: any[] = [];
    const rangeStart = this.ensureSuffix(start, RANGE_START_SUFFIX);
    const rangeEnd = this.ensureSuffix(end, RANGE_END_SUFFIX);
    const range = this.db.getRange({ start: rangeStart, end: rangeEnd });
    for (const { key, value } of range) {
      const keyString = key.toString();
      if (!this.isWithinRange(keyString, rangeStart, rangeEnd)) {
        if (rangeEnd && keyString > rangeEnd) break;
        continue;
      }
      values.push(this.deserializeValue(value));
    }
    return values;
  }

  put(chain: string[], value: any): string {
    const key = chain.join(KEY_SEPARATOR);
    this.db.put(key, this.serializeValue(value));
    return key;
  }

  get(chain: string[]): any {
    const key = chain.join(KEY_SEPARATOR);
    return this.deserializeValue(this.db.get(key));
  }

  getDirect(key: string): any {
    return this.deserializeValue(this.db.get(key));
  }

  delete(chain: string[]): void {
    const key = chain.join(KEY_SEPARATOR);
    this.db.delete(key);
  }

  getStats(): any {
    return {};
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async migrate(): Promise<void> {
    // todo move to superclass
    const migrations = this.migrations.map((migration) => new migration(this));
    const migrator = new Migrator(migrations, this.migrationsState);
    await migrator.up();
  }

  private serializeValue(value: any): Buffer {
    if (Buffer.isBuffer(value)) {
      return Buffer.concat([HEADER_BUFFER, value]);
    }
    if (value instanceof Uint8Array) {
      const buf = Buffer.from(value);
      return Buffer.concat([HEADER_BUFFER, buf]);
    }
    const payload = Buffer.from(JSON.stringify(value ?? null));
    return Buffer.concat([HEADER_JSON, payload]);
  }

  private deserializeValue(raw: Buffer | null): any {
    if (!raw) {
      return undefined;
    }
    if (raw.length >= HEADER_LENGTH) {
      const prefix = raw.subarray(0, HEADER_LENGTH);
      const payload = raw.subarray(HEADER_LENGTH);
      if (prefix.equals(HEADER_BUFFER)) {
        return Buffer.from(payload);
      }
      if (prefix.equals(HEADER_JSON)) {
        const text = payload.toString();
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
    }
    const fallback = raw.toString();
    if (!fallback.length) {
      return "";
    }
    try {
      return JSON.parse(fallback);
    } catch {
      return fallback;
    }
  }

  private isWithinRange(key: string, start?: string, end?: string): boolean {
    if (start && key < start) return false;
    if (end && key > end) return false;
    return true;
  }

  private ensureSuffix(input: string, suffix: string): string {
    if (input.endsWith(suffix)) {
      return input;
    }
    return input + suffix;
  }
}
