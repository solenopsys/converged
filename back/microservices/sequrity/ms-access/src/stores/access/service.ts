import { KVStore, JsonStore } from "back-core";
import {
  UserAccessRepository,
  UserAccessKey,
  UserAccessValue,
  PresetRepository,
  PresetKey,
  PRESET_PREFIX,
} from "./entities";
import type { Permission } from "../../types";

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
      if (!Array.isArray(legacyValue)) continue;
      await this.presetRepo.save(key, legacyValue as Permission[]);
    }
  }

  getUserAccess(userId: string): UserAccessValue {
    const existing = this.userAccessRepo.get(new UserAccessKey(userId));
    if (existing) {
      return existing;
    }
    return { userId, presets: [], permissions: [] };
  }

  saveUserAccess(userId: string, value: UserAccessValue): void {
    this.userAccessRepo.save(new UserAccessKey(userId), value);
  }

  getPermissionsFromUser(userId: string): Permission[] {
    return this.getUserAccess(userId).permissions;
  }

  async getPermissionsFromPreset(presetName: string): Promise<Permission[]> {
    return (await this.presetRepo.get(new PresetKey(presetName))) ?? [];
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

  async createPreset(presetName: string, permissions: Permission[]): Promise<void> {
    await this.presetRepo.save(new PresetKey(presetName), permissions);
  }

  async updatePreset(presetName: string, permissions: Permission[]): Promise<void> {
    await this.presetRepo.save(new PresetKey(presetName), permissions);
  }

  async deletePreset(presetName: string): Promise<void> {
    await this.presetRepo.delete(new PresetKey(presetName));
  }

  addPermissionToUser(userId: string, permission: Permission): void {
    const data = this.getUserAccess(userId);
    if (!data.permissions.includes(permission)) {
      data.permissions.push(permission);
      this.saveUserAccess(userId, data);
    }
  }

  removePermissionFromUser(userId: string, permission: Permission): void {
    const data = this.getUserAccess(userId);
    data.permissions = data.permissions.filter((p) => p !== permission);
    this.saveUserAccess(userId, data);
  }
}
