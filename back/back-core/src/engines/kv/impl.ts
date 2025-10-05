 
export type HashString = string; 



export interface KeyKV {
    build(): string[];
}

export abstract class PrefixKey {
    readonly prefix: string;
}

export abstract class SimpleKey extends PrefixKey implements KeyKV {
    constructor(protected id: string) {
        super()
    }

    build(): string[] {
        return [this.prefix, this.id];
    }
}

export class NameVersionKey extends PrefixKey implements KeyKV {
    constructor(private name: string, private version: string) {
        super()
    }

    build(): string[] {
        return [this.prefix, this.name, this.version];
    }
}

import { type  Entity } from "../../types";



export interface RepositoryKV<K extends KeyKV, V> {
    save(key: K, value: V): void;
    get(key: K): V | undefined;
}

export abstract class BaseRepositoryKV<K extends KeyKV, V extends Entity> implements RepositoryKV<K, V> {

    constructor(protected store: KVStore) { }

    save(key: K, value: V): string {
       return this.db.set(key.build(), value);
    }

    get(key: K): V | undefined {
        return this.db.get(key.build()) as V;
    }

    getDirect(key:string): V | undefined {
        return this.db.getDirect(key) as V;
    }

    delete(key: K): void {
        this.db.delete(key.build());
    }
}

export abstract class PrefixedRepositoryKV<K extends KeyKV, V extends Entity> extends BaseRepositoryKV<K, V> {

    constructor(protected db: KVDB) {
        super(db);
    }

    abstract getPrefix(): string[];

    listKeys(): string[] {
        return this.db.listKeys(this.getPrefix());
    }
}

export abstract class VersionsRepository<K extends KeyKV, V  extends Entity> extends PrefixedRepositoryKV<K, V> {

    getVersionsKeys(name: string): string[] {
        return this.db.listKeys([...this.getPrefix(), name]);
    }

    getVersions(name: string):   V[]  {
        const versions: V[] = [];
        const keys = this.getVersionsKeys(name);
        for (const key of keys) {
            const version = key.split(":")[2];
            const value = this.db.get([...this.getPrefix(), name, version]);
            versions.push(value);
        }
        return versions;
    }

    getLastVersion(name: string) {
        const keys = this.getVersionsKeys(name);
        if (keys.length==0){
          return undefined;
        }
        const lastKey = keys[keys.length - 1]; 
        return lastKey;
      }
    
}


