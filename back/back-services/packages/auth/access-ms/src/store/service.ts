import { UserPermissionRepository } from "./entites";
import { PresetRepository } from "./entites";
import { KVDB } from "back-core";
import { UserPermissionKey } from "./entites";
import { UserPermissionValue } from "./entites";
import { PresetKey } from "./entites";
import {Permission} from "../types"

class AccessStoreService {
    public readonly userPermissionRepo: UserPermissionRepository;
    public readonly presetRepo: PresetRepository;
    
  
    constructor(db: KVDB) {
      this.userPermissionRepo = new UserPermissionRepository(db);
      this.presetRepo = new PresetRepository(db); 
    }

    getUserPermissions(userId: string): UserPermissionValue{
        return this.userPermissionRepo.get(new UserPermissionKey(userId))
    }

    getPresets(): string[] {
        return this.presetRepo.listKeys();
    }

    getPermissionsFromPreset(presetName: string): string[] {
        return this.presetRepo.get(new PresetKey(presetName));
    }

    linkPresetToUser(userId: string, presetName: string): void {
        const userPermissions = this.getUserPermissions(userId);
        userPermissions.presets.push(presetName);
        this.userPermissionRepo.save(new UserPermissionKey(userId), userPermissions);
    }

    unlinkPresetFromUser(userId: string, presetName: string): void {
        const userPermissions = this.getUserPermissions(userId);
        userPermissions.presets = userPermissions.presets.filter(p => p !== presetName);
        this.userPermissionRepo.save(new UserPermissionKey(userId), userPermissions);
    }

    createPreset(presetName: string, permissions: string[]): void {
        this.presetRepo.save(new PresetKey(presetName), permissions);
    }

    updatePreset(presetName: string, permissions: string[]): void {
        this.presetRepo.save(new PresetKey(presetName), permissions);
    }

    deletePreset(presetName: string): void {
        this.presetRepo.delete(new PresetKey(presetName));
    }

    addPermissionToUser(userId: string, permission: Permission): void {
        const userPermissions = this.getUserPermissions(userId);
        userPermissions.permissions.push(permission);
        this.userPermissionRepo.save(new UserPermissionKey(userId), userPermissions);
    }

    removePermissionFromUser(userId: string, permission: Permission): void {
        const userPermissions = this.getUserPermissions(userId);
        userPermissions.permissions = userPermissions.permissions.filter(p => p !== permission);
        this.userPermissionRepo.save(new UserPermissionKey(userId), userPermissions);
    }
}

export { AccessStoreService };