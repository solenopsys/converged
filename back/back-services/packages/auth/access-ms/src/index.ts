

// Минималистичная реализация ABAC с JSON в LMDB

import { AccessStoreService } from "./store/service";
import { Permission, AccesService } from "./types";
import { secureAll, SecureType, secure } from "nrpc";

@secureAll(SecureType.PERMISSION)
export default class AccessServiceImpl implements AccesService {
    private readonly accessStoreService: AccessStoreService;
    constructor(private db: any) {
        this.accessStoreService = new AccessStoreService(db)
    }
 
 
    @secure(SecureType.AUTH)
    emitJWT(userId: string): Promise<string> {
        throw new Error("Method not implemented");
    }

    async getPermissionsFromUser(userId: string): Promise<Permission[]> {     
        return this.accessStoreService.getUserPermissions(userId).permissions;
    }

    async getPermissionsMixinFromUser(userId: string): Promise<string[]> {
        const data = await this.accessStoreService.getUserPermissions(userId);
        const permissions = new Set(data.permissions);
        
        for (const presetName of data.presets) {
            const presetPerms = await this.accessStoreService.getPermissionsFromPreset(presetName);
            if (presetPerms) {
                presetPerms.forEach((p: string) => permissions.add(p));
            }
        }
        
        return [...permissions];
    }

    async linkPresetToUser(userId: string, presetName: string): Promise<void> {
        await this.accessStoreService.linkPresetToUser(userId, presetName);
    }

    async unlinkPresetFromUser(userId: string, presetName: string): Promise<void> {
        await this.accessStoreService.unlinkPresetFromUser(userId, presetName);
    }

    async createPreset(presetName: string, permissions: string[]): Promise<void> {
        await this.accessStoreService.createPreset(presetName, permissions);
    }

    async updatePreset(presetName: string, permissions: string[]): Promise<void> {
        await this.accessStoreService.updatePreset(presetName, permissions);
    }

    async deletePreset(presetName: string): Promise<void> {
        await this.accessStoreService.deletePreset(presetName);
    }

    async getPreset(presetName: string): Promise<string[]> {
        return this.accessStoreService.getPermissionsFromPreset(presetName);
    }

    async getAllPresets(): Promise<{ name: string, permissions: string[] }[]> {
        const presets = this.accessStoreService.getPresets();
        const result: { name: string, permissions: string[] }[] = [];
        for (const preset of presets) {
            result.push({ name: preset, permissions: this.accessStoreService.getPermissionsFromPreset(preset) });
        }
        return result;
    }

    async addPermissionToUser(userId: string, permission: Permission): Promise<void> {
        await this.accessStoreService.addPermissionToUser(userId, permission);
    }
    
    async removePermissionFromUser(userId: string, permission: Permission): Promise<void> {
        await this.accessStoreService.removePermissionFromUser(userId, permission);
    }
    
}