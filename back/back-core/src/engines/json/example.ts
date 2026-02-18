import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { type Entity } from "../../types";

export type HashString = string;

export interface JsonDB {
    get(key: string): any | undefined;
    set(key: string, value: any): string;
    delete(key: string): void;
    listKeys(): string[];
    getAll(): any;
}

export class JsonDBImpl implements JsonDB {
    private db: Low<Record<string, any>>;

    constructor(filePath: string) {
        const adapter = new JSONFile(filePath);
        this.db = new Low(adapter, {});
    }

    async init() {
        await this.db.read();
        this.db.data ||= {};
    }

    get(key: string): any | undefined {
        return this.db.data[key];
    }

    set(key: string, value: any): string {
        this.db.data[key] = value;
        this.db.write();
        return key;
    }

    delete(key: string): void {
        delete this.db.data[key];
        this.db.write();
    }

    listKeys(): string[] {
        return Object.keys(this.db.data);
    }

    getAll(): any {
        return this.db.data;
    }
}

export interface KeyJson {
    build(): string;
}

export abstract class SimpleKeyJson implements KeyJson {
    constructor(protected id: string) {}
    
    build(): string {
        return this.id;
    }
}

export interface RepositoryJson<K extends KeyJson, V> {
    save(key: K, value: V): void;
    get(key: K): V | undefined;
}

export abstract class BaseRepositoryJson<K extends KeyJson, V extends Entity> implements RepositoryJson<K, V> {
    constructor(protected db: JsonDB) {}

    save(key: K, value: V): string {
        return this.db.set(key.build(), value);
    }

    get(key: K): V | undefined {
        return this.db.get(key.build()) as V;
    }

    delete(key: K): void {
        this.db.delete(key.build());
    }

    listKeys(): string[] {
        return this.db.listKeys();
    }

    getAll(): V[] {
        return Object.values(this.db.getAll());
    }
}