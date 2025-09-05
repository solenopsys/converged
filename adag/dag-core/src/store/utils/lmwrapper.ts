import * as lmdb from 'lmdb';
import { join } from 'path';
import { KEY_SEPARATOR, RANGE_END_SUFFIX, RANGE_START_SUFFIX } from './utils';
 

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

    getVeluesRangeAsObjectWithPrefix(prefixChain: string):  {[key:string]:any} {
        const prefix = prefixChain;
        return this.getVeluesRangeAsObject(
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

    getVeluesRangeAsObject(start: string, end: string): {[key:string]:any} {
        const keys: {[key:string]:any} = {}; 
        const range = this.db.getRange({ start, end });
  
        for (const { key, value } of range) { 
            const keyString = key as string;
            const lastSegment= keyString.split(KEY_SEPARATOR)[keyString.split(KEY_SEPARATOR).length-1];
            keys[lastSegment]=value;
        }
        return keys;
    }


    put(chain: string[], value: any): string {
        const key = chain.join(KEY_SEPARATOR);
        this.db.put(key, value);
        return key;
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

