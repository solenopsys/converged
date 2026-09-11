import { KVStore, JsonStore } from "back-core";
import {
  UserAccessRepository,
  UserAccessKey,
  UserAccessValue,
  PresetRepository,
  PresetKey,
  PRESET_PREFIX,
} from "./entities";
import {
  ACCESS_TAG_KIND,
  grantPermission,
  parsePermission,
  revokePermission,
  tagsFromGrantTree,
  toGrantTree,
} from "nrpc";
import type { GrantTree, Permission } from "../../types";

export class AccessStoreService {
  private readonly accessStore: KVStore;
  public readonly userAccessRepo: UserAccessRepository;
  public readonly presetRepo: PresetRepository;

  constructor(accessStore: KVStore, presetsStore: JsonStore) {
    this.accessStore = accessStore;
    this.userAccessRepo = new UserAccessRepository(accessStore);
    this.presetRepo = new PresetRepository(presetsStore);
  }

  async migrateLegacyPresetsFromAccessStore(): Promise<void> {
    const legacyKeys = this.accessStore.listKeys([PRESET_PREFIX]);
    for (const legacyKey of legacyKeys) {
      const presetName = legacyKey.split(":").slice(1).join(":");
      if (!presetName) continue;

      const key = new PresetKey(presetName);
      if (this.presetRepo.exists(key)) continue;

      const legacyValue = this.accessStore.getDirect(legacyKey);
      if (!legacyValue || typeof legacyValue !== "object" || Array.isArray(legacyValue)) continue;
      await this.presetRepo.save(key, legacyValue as GrantTree);
    }
  }

  getUserAccess(userId: string): UserAccessValue {
    const existing = this.findUserAccess(userId);
    if (existing) {
      return { ...existing, permissions: normalizePermissions(existing.permissions) };
    }
    return { userId, presets: [], permissions: {} };
  }

  findUserAccess(userId: string): UserAccessValue | null {
    return this.userAccessRepo.get(new UserAccessKey(userId)) ?? null;
  }

  saveUserAccess(userId: string, value: UserAccessValue): void {
    this.userAccessRepo.save(new UserAccessKey(userId), value);
  }

  hasUserAccess(userId: string): boolean {
    return this.userAccessRepo.get(new UserAccessKey(userId)) !== null;
  }

  getPermissionsFromUser(userId: string): GrantTree {
    return this.getUserAccess(userId).permissions;
  }

  async getPermissionsFromPresetWithMeta(
    presetName: string,
  ): Promise<{ permissions: GrantTree; found: boolean }> {
    const preset = await this.presetRepo.get(new PresetKey(presetName));
    if (!preset) {
      return { permissions: {}, found: false };
    }
    return { permissions: preset, found: true };
  }

  async getPermissionsFromPreset(presetName: string): Promise<GrantTree> {
    const preset = await this.getPermissionsFromPresetWithMeta(presetName);
    return preset.permissions;
  }

  async getPresetWithMeta(
    presetName: string,
  ): Promise<{ exists: boolean; permissions: GrantTree }> {
    const key = new PresetKey(presetName);
    const exists = this.presetRepo.exists(key);
    const permissions = (await this.presetRepo.get(key)) ?? {};
    return { exists, permissions };
  }

  async getPresets(): Promise<string[]> {
    const keys = await this.presetRepo.listKeys();
    return keys
      .map((key) => key.split("/").slice(1).join("/"))
      .filter((name) => name.length > 0);
  }

  linkPresetToUser(userId: string, presetName: string): void {
    const data = this.getUserAccess(userId);
    if (!data.presets.includes(presetName)) {
      data.presets.push(presetName);
      this.saveUserAccess(userId, data);
    }
  }

  unlinkPresetFromUser(userId: string, presetName: string): void {
    const data = this.getUserAccess(userId);
    data.presets = data.presets.filter((name) => name !== presetName);
    this.saveUserAccess(userId, data);
  }

  async createPreset(presetName: string, permissions: GrantTree): Promise<void> {
    await this.presetRepo.save(new PresetKey(presetName), permissions);
  }

  async updatePreset(presetName: string, permissions: GrantTree): Promise<void> {
    await this.presetRepo.save(new PresetKey(presetName), permissions);
  }

  async deletePreset(presetName: string): Promise<void> {
    await this.presetRepo.delete(new PresetKey(presetName));
  }

  addPermissionToUser(userId: string, permission: Permission): void {
    const data = this.getUserAccess(userId);
    data.permissions = grantPermission(data.permissions, permission);
    this.saveUserAccess(userId, data);
  }

  removePermissionFromUser(userId: string, permission: Permission): void {
    const data = this.getUserAccess(userId);
    data.permissions = revokePermission(data.permissions, permission);
    this.saveUserAccess(userId, data);
  }

  /**
   * Access tags are ordinary grants under the `tg` kind, so putting a user in a
   * group is one permission write and needs no store of its own. The wrappers
   * exist so callers never hand-assemble the grant string and cannot land a tag
   * under the wrong kind, where nothing would ever read it.
   */
  addTagToUser(userId: string, tag: string, mode: string = "r"): void {
    this.addPermissionToUser(userId, tagGrant(tag, mode) as Permission);
  }

  removeTagFromUser(userId: string, tag: string, mode: string = "rwx"): void {
    this.removePermissionFromUser(userId, tagGrant(tag, mode) as Permission);
  }

  getTagsOfUser(userId: string): string[] {
    return tagsFromGrantTree(this.getPermissionsFromUser(userId));
  }
}

/**
 * Records written before grants were stored as a tree hold a flat array of
 * permission strings instead. Nothing reads that shape any more, so such a user
 * silently resolves to no permissions at all — and worse, granting anything to
 * them used to rewrite the record from an empty parse, dropping whatever was
 * there. Converting on read keeps both from happening while the old rows last.
 */
export function normalizePermissions(permissions: unknown): GrantTree {
  if (!Array.isArray(permissions)) return (permissions as GrantTree) ?? {};
  const entries = permissions
    .filter((value): value is string => typeof value === "string")
    .map((value) => parsePermission(value))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  return toGrantTree(entries);
}

/**
 * A tag must survive two grammars: the permission string it is written as, and
 * the key it later becomes in a key-value store. Rejecting the separators of
 * both here keeps a malformed tag from being stored as something that silently
 * matches the wrong objects.
 */
const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function tagGrant(tag: string, mode: string): string {
  const normalized = tag.trim();
  if (!TAG_RE.test(normalized)) {
    throw new Error(
      `invalid access tag "${tag}": expected letters, digits, dot, dash or underscore`,
    );
  }
  if (!/^[rwx]+$/i.test(mode)) throw new Error(`invalid access tag mode "${mode}"`);
  return `${ACCESS_TAG_KIND}/${normalized}/*(${mode.toLowerCase()})`;
}
