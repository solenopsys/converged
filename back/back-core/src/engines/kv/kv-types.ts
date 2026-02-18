export type HashString = string;

export interface KeyKV {
  build(): string[];
}

export abstract class PrefixKey {
  readonly prefix: string;
}

export abstract class SimpleKey extends PrefixKey implements KeyKV {
  constructor(protected id: string) {
    super();
  }

  build(): string[] {
    return [this.prefix, this.id];
  }
}

export class NameVersionKey extends PrefixKey implements KeyKV {
  constructor(
    private name: string,
    private version: string,
  ) {
    super();
  }

  build(): string[] {
    return [this.prefix, this.name, this.version];
  }
}

export interface FindAllOptions {
  prefix?: string[];
}

export interface RepositorySchema<K extends KeyKV, V> {
  prefix: string[];
  extractKey?: (entity: V) => K;
}

export interface RepositoryKV<K extends KeyKV, V> {
  save(key: K, value: V): string;
  get(key: K): V | undefined;
  delete(key: K): void;
  listKeys(): string[];
  listValues(): V[];
}
