import { PrefixedRepositoryKV, SimpleKey } from "back-core";

export const PERSISTENT_PREFIX = "persistent";

export class PersistentKey extends SimpleKey {
  readonly prefix = PERSISTENT_PREFIX;
}

export type PersistentValue = any;

export class PersistentRepository extends PrefixedRepositoryKV<PersistentKey, PersistentValue> {
  getPrefix(): string[] {
    return [PERSISTENT_PREFIX];
  }
}
