import * as lmdb from 'lmdb';
import { join } from 'path';
 
const KEY_SEPARATOR = ":";
const RANGE_START_SUFFIX = KEY_SEPARATOR;
const RANGE_END_SUFFIX = ";";

export class LMWrapper {
    private db!: lmdb.Database;

    constructor(private dataDir: string, private dbName: string) {
        this.init();
    }

    init() {
        const path = join(this.dataDir, this.dbName + '.lmdb');
        this.db = lmdb.open(path, {});
    }

    getKeysWithPrefix(prefixChain: string[]): string[] {
        const prefix = prefixChain.join(KEY_SEPARATOR);
        return this.getKeysWithRange(
            prefix + RANGE_START_SUFFIX,
            prefix + RANGE_END_SUFFIX
        );
    }

    getKeysWithRange(start: string, end: string): string[] {
        const keys: string[] = []; 
        const range = this.db.getRange({ start, end });
        for (const { key, value } of range) { 
            keys.push(key as string);
        }
        return keys;
    }

    put(chain: string[], value: any): void {
        const key = chain.join(KEY_SEPARATOR);
        this.db.put(key, value);
    }

    get(chain: string[]): any {
        const key = chain.join(KEY_SEPARATOR);
        return this.db.get(key);
    }

    getStats(): any {
        return this.db.getStats?.() || {};
    }

    close(): void {
        if (this.db) {
            this.db.close();
        }
    }

    deinit(): void {
        this.close();
    }
}

