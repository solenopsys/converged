import { PrefixedRepositoryKV, SimpleKey, BaseKeyJson, BaseRepositoryJson } from "back-core";
import type { Permission } from "../../types";

const USER_ACCESS_PREFIX = "user_access";
class UserAccessKey extends SimpleKey {
  readonly prefix = USER_ACCESS_PREFIX;
}

export type UserAccessValue = {
  userId: string;
  presets: string[];
  permissions: Permission[];
};

class UserAccessRepository extends PrefixedRepositoryKV<
  UserAccessKey,
  UserAccessValue
> {
  getPrefix(): string[] {
    return [USER_ACCESS_PREFIX];
  }
}

const PRESET_PREFIX = "preset";
class PresetKey extends BaseKeyJson {
  readonly type = PRESET_PREFIX;
}

export type PresetValue = Permission[];

class PresetRepository extends BaseRepositoryJson<PresetKey, PresetValue> {}

export {
  USER_ACCESS_PREFIX,
  UserAccessKey,
  UserAccessRepository,
  PRESET_PREFIX,
  PresetKey,
  PresetRepository,
};
