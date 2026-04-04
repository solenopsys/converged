import { StorageConnection } from "bun-transport";
import {
  KEY_SEPARATOR,
  RANGE_END_SUFFIX,
  RANGE_START_SUFFIX,
} from "../../utils";
import { Store } from "../../stores";
import { Migration, Migrator } from "../../migrations";
import { TransportMigrationStateStorage } from "../transport/transport-driver";

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
  private conn: StorageConnection;
  private ms: string;
  private storeName: string;
  private migrations: (new (store: Store) => Migration)[];

  constructor(
    conn: StorageConnection,
    ms: string,
    storeName: string,
    migrations: (new (store: Store) => Migration)[],
  ) {
    this.conn = conn;
    this.ms = ms;
    this.storeName = storeName;
    this.migrations = migrations;
  }

  listKeys(prefix: string[]): string[] {
    return this.getKeysWithPrefix(prefix);
  }

  async open() {
    this.conn.open(this.ms, this.storeName, "kv");
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
    const prefix = this.extractPrefix(start, end);
    return this.conn.kvList(this.ms, this.storeName, prefix);
  }

  getVeluesRangeAsObject(start: string, end: string): { [key: string]: any } {
    const keys = this.getKeysWithRange(start, end);
    const result: { [key: string]: any } = {};
    for (const key of keys) {
      const value = this.getDirect(key);
      const parts = key.split(KEY_SEPARATOR);
      const lastSegment = parts[parts.length - 1];
      result[lastSegment] = value;
    }
    return result;
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
    const prefix = this.extractPrefix(start, end);
    const rawValues = this.conn.kvGetRange(this.ms, this.storeName, prefix);
    return rawValues.map((buf) => this.deserializeValue(buf));
  }

  put(chain: string[], value: any): string {
    const key = chain.join(KEY_SEPARATOR);
    this.conn.kvPut(this.ms, this.storeName, key, this.serializeValue(value));
    return key;
  }

  get(chain: string[]): any {
    const key = chain.join(KEY_SEPARATOR);
    return this.getDirect(key);
  }

  getDirect(key: string): any {
    return this.deserializeValue(this.conn.kvGet(this.ms, this.storeName, key));
  }

  getRawDirect(key: string): Buffer | null {
    return this.conn.kvGet(this.ms, this.storeName, key);
  }

  delete(chain: string[]): void {
    const key = chain.join(KEY_SEPARATOR);
    this.conn.kvDelete(this.ms, this.storeName, key);
  }

  getSize(): bigint {
    return this.conn.getSize(this.ms, this.storeName);
  }

  compact(): void {
    this.conn.kvCompact(this.ms, this.storeName);
  }

  getStats(): any {
    return {};
  }

  async close(): Promise<void> {
    this.conn.close_store(this.ms, this.storeName);
  }

  async migrate(): Promise<void> {
    const migrations = this.migrations.map((migration) => new migration(this));
    const stateStorage = new TransportMigrationStateStorage(this.conn, this.ms, this.storeName);
    const migrator = new Migrator(migrations, stateStorage);
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

  private extractPrefix(start: string, end: string): string {
    if (start.endsWith(RANGE_START_SUFFIX) && end.endsWith(RANGE_END_SUFFIX)) {
      return start.slice(0, -RANGE_START_SUFFIX.length);
    }
    throw new Error(`KV does not support arbitrary range: ${start}..${end}`);
  }
}
