import * as fs from 'fs';
import * as path from 'path';
import { type Entity } from "../../types";

export type HashString = string;

// Интерфейс сериализатора
export interface Serializer<T = any> {
    serialize(value: T): Buffer | string;
    deserialize(data: Buffer): T | undefined;
}

// JSON сериализатор
export class JSONSerializer implements Serializer {
    serialize(value: any): string {
        return JSON.stringify(value, null, 2);
    }

    deserialize(data: Buffer): any | undefined {
        try {
            return JSON.parse(data.toString());
        } catch {
            return undefined;
        }
    }
}

// Бинарный сериализатор
export class BinarySerializer implements Serializer<Buffer> {
    serialize(value: Buffer): Buffer {
        return value;
    }

    deserialize(data: Buffer): Buffer {
        return data;
    }
}

export interface FileDB {
    get(key: string[]): any | undefined; 
    set(key: string[], value: any): string;
    delete(key: string[]): void;
    listKeys(prefix: string[]): string[];
}

export class FileDBImpl implements FileDB {
    constructor(
        private basePath: string, 
        private serializer: Serializer = new JSONSerializer()
    ) {}

    private toPath(key: string[]): string {
        return path.join(this.basePath, ...key);
    }

    get(key: string[]): any | undefined {
        return this.getDirect(this.toPath(key));
    }

    getDirect(filePath: string): any | undefined {
        try {
            const data = fs.readFileSync(filePath);
            return this.serializer.deserialize(data);
        } catch {
            return undefined;
        }
    }

    set(key: string[], value: any): string {
        const filePath = this.toPath(key);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        const data = this.serializer.serialize(value);
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    delete(key: string[]): void {
        try {
            fs.unlinkSync(this.toPath(key));
        } catch {}
    }

    listKeys(prefix: string[]): string[] {
        const dir = this.toPath(prefix);
        try {
            return fs.readdirSync(dir).map(f => [...prefix, f].join(':'));
        } catch {
            return [];
        }
    }
}

export interface KeyFile {
    build(): string[];
}

export abstract class PrefixKey {
    readonly prefix: string;
}

export abstract class SimpleKey extends PrefixKey implements KeyFile {
    constructor(protected id: string) {
        super();
    }
    build(): string[] {
        return [this.prefix, this.id];
    }
}

export interface RepositoryFile<K extends KeyFile, V> {
    save(key: K, value: V): void;
    get(key: K): V | undefined;
}

export abstract class BaseRepositoryFile<K extends KeyFile, V extends Entity> implements RepositoryFile<K, V> {
    constructor(protected db: FileDB) {}

    save(key: K, value: V): string {
        return this.db.set(key.build(), value);
    }

    get(key: K): V | undefined {
        return this.db.get(key.build()) as V;
    }

    getDirect(key: string): V | undefined {
        return this.db.getDirect(key) as V;
    }

    delete(key: K): void {
        this.db.delete(key.build());
    }
}