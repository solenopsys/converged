import { KVStore } from "back-core";
import {
  UserAccessRepository,
  UserAccessKey,
  UserAccessValue,
  PresetRepository,
  PresetKey,
} from "./entities";
import type { Permission } from "../../types";

export class AccessStoreService {
  public readonly userAccessRepo: UserAccessRepository;
  public readonly presetRepo: PresetRepository;

  constructor(store: KVStore) {
    this.userAccessRepo = new UserAccessRepository(store);
    this.presetRepo = new PresetRepository(store);
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

  getPermissionsFromPreset(presetName: string): Permission[] {
    return this.presetRepo.get(new PresetKey(presetName)) ?? [];
  }

  getPresets(): string[] {
    return this.presetRepo
      .listKeys()
      .map((key) => key.split(":").slice(1).join(":"))
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

  createPreset(presetName: string, permissions: Permission[]): void {
    this.presetRepo.save(new PresetKey(presetName), permissions);
  }

  updatePreset(presetName: string, permissions: Permission[]): void {
    this.presetRepo.save(new PresetKey(presetName), permissions);
  }

  deletePreset(presetName: string): void {
    this.presetRepo.delete(new PresetKey(presetName));
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
