import * as lmdb from 'lmdb';
import { join } from 'path';
import { KEY_SEPARATOR, RANGE_END_SUFFIX, RANGE_START_SUFFIX } from '../../utils';
import { Store } from "../../stores";
import { Migration, Migrator } from "../../migrations";
import { MigrationStateStorage } from "../../migrations";

export interface KVStoreIntf {
    get(key: string[]): any | undefined;
    put(key: string[], value: any): string;
    delete(key: string[]): void;
    listKeys(prefix: string[]): string[];

}

export class KVStore implements KVStoreIntf, Store {
    private db!: lmdb.Database;

    constructor(private dataLocation: string,   private migrations: (new (store: Store) => Migration)[],
        private migrationsState: MigrationStateStorage) {

    }


    listKeys(prefix: string[]): string[] {
        return this.getKeysWithPrefix(prefix);
    }

    async open() {
       
        this.db = lmdb.open(this.dataLocation, {});
    }

    getKeysWithPrefix(prefixChain: string[]): string[] {
        const prefix = prefixChain.join(KEY_SEPARATOR);
        return this.getKeysWithRange(
            prefix + RANGE_START_SUFFIX,
            prefix + RANGE_END_SUFFIX
        );
    }

    getVeluesRangeAsObjectWithPrefix(prefixChain: string): { [key: string]: any } {
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

    getVeluesRangeAsObject(start: string, end: string): { [key: string]: any } {
        const keys: { [key: string]: any } = {};
        const range = this.db.getRange({ start, end });

        for (const { key, value } of range) {
            const keyString = key as string;
            const lastSegment = keyString.split(KEY_SEPARATOR)[keyString.split(KEY_SEPARATOR).length - 1];
            keys[lastSegment] = value;
        }
        return keys;
    }

    getValuesRangeAsArrayByPrefixChain(prefixChain: string[]): any[] {
        return this.getValuesRangeAsArrayByPrefix(prefixChain.join(KEY_SEPARATOR));
    }

    getValuesRangeAsArrayByPrefix(prefixChain: string): any[] {
        return this.getValuesRangeAsArrayByRange(prefixChain + RANGE_START_SUFFIX, prefixChain + RANGE_END_SUFFIX);
    }

    getValuesRangeAsArrayByRange(start: string, end: string): any[] {
        const values: any[] = [];
        const range = this.db.getRange({ start: start + RANGE_START_SUFFIX, end: end + RANGE_END_SUFFIX });
        for (const { value } of range) {
            values.push(value);
        }
        return values;
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

    getDirect(key:string): any {
        return this.db.get(key);
    }

    delete(chain: string[]): void {
        const key = chain.join(KEY_SEPARATOR);
        this.db.remove(key);
    }

    getStats(): any {
        return this.db.getStats?.() || {};
    }

    async close(): Promise<void> {
        this.db.close();
    }



    async migrate(): Promise<void> { // todo move to superclass
        const migrations = this.migrations.map((migration) => new migration(this));
        const migrator = new Migrator(migrations, this.migrationsState);
        await migrator.up();
    }
}

