import { PrefixedRepositoryKV, SimpleKey } from "back-core";

export const RECORD_PREFIX = "record";

export class RecordKey extends SimpleKey {
  readonly prefix = RECORD_PREFIX;
}

export type RecordValue = {
  data: any;
  result: any;
};

export class RecordRepository extends PrefixedRepositoryKV<RecordKey, RecordValue> {
  getPrefix(): string[] {
    return [RECORD_PREFIX];
  }
}
