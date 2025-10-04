import { createStore } from "./stores";
export type HashString = string;

export interface KVDB {
    get(key: string[]): any | undefined;
    getDirect(key:string): any | undefined;
    set(key: string[], value: any): string;
    delete(key: string[]): void;
    listKeys(prefix: string[]): string[];

}

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



export interface RepositoryKV<K extends KeyKV, V> {
    save(key: K, value: V): void;
    get(key: K): V | undefined;
}

export abstract class BaseRepositoryKV<K extends KeyKV, V extends any> implements RepositoryKV<K, V> {

    constructor(protected db: KVDB) { }

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

export abstract class PrefixedRepositoryKV<K extends KeyKV, V extends any> extends BaseRepositoryKV<K, V> {

    constructor(protected db: KVDB) {
        super(db);
    }

    abstract getPrefix(): string[];

    listKeys(): string[] {
        return this.db.listKeys(this.getPrefix());
    }
}

export abstract class VersionsRepository<K extends KeyKV, V > extends PrefixedRepositoryKV<K, V> {

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

export interface Store { 
    open(): Promise<void>;
    close(): Promise<void>;
    migrate(): Promise<void>;
}

export class StoreControllerAbstract  {
 


    constructor(protected msName: string) {
        this.msName = msName;
    }
    protected stores:{[key:string]: Store} = {};


    async startAll(){
        for(const store of Object.values(this.stores)){
            await store.open();
        }
    }

    async closeAll(){
        for(const store of Object.values(this.stores)){
            await store.close();
        }
    }

    async migrateAll(){
        for(const store of Object.values(this.stores)){
            await store.migrate();
        }
    }


    addStore(name,type):Store{
        this.stores[name] = createStore(this.msName,name, type) ;
        return this.stores[name];
    }
}

export enum StoreType {
    SQL = "SQL",
    FILES = "FILES",
    COLUMN = "COLUMN",
    KVS = "KEY_VALUE",
}

export interface Entity {
    id: string
}

export const DATA_DIR="./data"