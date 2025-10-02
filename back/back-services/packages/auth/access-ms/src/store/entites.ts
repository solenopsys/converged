import { PrefixedRepositoryKV, SimpleKey } from "back-core";


import { Permission } from "../../../../../../../types/access";


// user_permission
const USER_PERMISSION_PREFIX = "user_permission";
class UserPermissionKey extends SimpleKey {
    readonly prefix = USER_PERMISSION_PREFIX;
}
type UserPermissionValue ={presets: string[], permissions: Permission[]};
class UserPermissionRepository extends PrefixedRepositoryKV<UserPermissionKey, UserPermissionValue> {
    getPrefix(): string[] {
        return [USER_PERMISSION_PREFIX];
    }
}

export { USER_PERMISSION_PREFIX as USER_PREFIX, UserPermissionKey, UserPermissionRepository, type UserPermissionValue }

// preset
const PRESET_PREFIX = "preset";
class PresetKey extends SimpleKey {
    readonly prefix = PRESET_PREFIX;
}
type PresetValue = Permission[];
class PresetRepository extends PrefixedRepositoryKV<PresetKey, PresetValue> {
    getPrefix(): string[] {
        return [PRESET_PREFIX];
    }
}

export { PRESET_PREFIX, PresetKey, PresetRepository, type PresetValue }

