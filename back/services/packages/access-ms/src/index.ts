// Минималистичная реализация ABAC с JSON в LMDB

import { AccesService } from "../../../../../types/access";

/**
 * Схема ключей:
 * u:{userId} -> { perms: string[], presets: string[] }
 * p:{presetName} -> string[] (массив прав)
 */

export default class LMDBAccessService implements AccesService {
    constructor(private db: any) {}

    // Helpers
    private async getUserData(userId: string): Promise<{ perms: string[], presets: string[] }> {
        const data = await this.db.get(`u:${userId}`);
        return data ? JSON.parse(data) : { perms: [], presets: [] };
    }

    private async setUserData(userId: string, data: { perms: string[], presets: string[] }): Promise<void> {
        await this.db.put(`u:${userId}`, JSON.stringify(data));
    }

    // User permissions
    async addPermissionToUser(userId: string, permission: string): Promise<void> {
        const data = await this.getUserData(userId);
        const perms = new Set(data.perms);
        perms.add(permission);
        data.perms = [...perms];
        await this.setUserData(userId, data);
    }

    async removePermissionFromUser(userId: string, permission: string): Promise<void> {
        const data = await this.getUserData(userId);
        data.perms = data.perms.filter(p => p !== permission);
        await this.setUserData(userId, data);
    }

    async getPermissionsFromUser(userId: string): Promise<string[]> {
        const data = await this.getUserData(userId);
        return data.perms;
    }

    async getPermissionsMixinFromUser(userId: string): Promise<string[]> {
        const data = await this.getUserData(userId);
        const permissions = new Set(data.perms);
        
        for (const presetName of data.presets) {
            const presetPerms = await this.db.get(`p:${presetName}`);
            if (presetPerms) {
                JSON.parse(presetPerms).forEach((p: string) => permissions.add(p));
            }
        }
        
        return [...permissions];
    }

    // User presets
    async linkPresetToUser(userId: string, presetName: string): Promise<void> {
        const preset = await this.db.get(`p:${presetName}`);
        if (!preset) throw new Error(`Preset ${presetName} not found`);
        
        const data = await this.getUserData(userId);
        const presets = new Set(data.presets);
        presets.add(presetName);
        data.presets = [...presets];
        await this.setUserData(userId, data);
    }

    async unlinkPresetFromUser(userId: string, presetName: string): Promise<void> {
        const data = await this.getUserData(userId);
        data.presets = data.presets.filter(p => p !== presetName);
        await this.setUserData(userId, data);
    }

    // Presets
    async createPreset(presetName: string, permissions: string[]): Promise<void> {
        const exists = await this.db.get(`p:${presetName}`);
        if (exists) throw new Error(`Preset ${presetName} already exists`);
        
        await this.db.put(`p:${presetName}`, JSON.stringify(permissions));
    }

    async updatePreset(presetName: string, permissions: string[]): Promise<void> {
        const exists = await this.db.get(`p:${presetName}`);
        if (!exists) throw new Error(`Preset ${presetName} not found`);
        
        await this.db.put(`p:${presetName}`, JSON.stringify(permissions));
    }

    async deletePreset(presetName: string): Promise<void> {
        const txn = this.db.env.beginTxn();
        
        try {
            // Проверяем существование и удаляем пресет
            if (!txn.getString(this.db.dbi, `p:${presetName}`)) {
                throw new Error(`Preset ${presetName} not found`);
            }
            txn.del(this.db.dbi, `p:${presetName}`);
            
            // Удаляем пресет у всех пользователей
            const cursor = txn.openCursor(this.db.dbi);
            for (let key = cursor.goToRange('u:'); key; key = cursor.goToNext()) {
                if (!key.startsWith('u:')) break;
                
                const data = JSON.parse(cursor.getCurrentString());
                if (data.presets?.includes(presetName)) {
                    data.presets = data.presets.filter((p: string) => p !== presetName);
                    txn.putString(this.db.dbi, key, JSON.stringify(data));
                }
            }
            cursor.close();
            txn.commit();
        } catch (e) {
            txn.abort();
            throw e;
        }
    }

    async getPreset(presetName: string): Promise<string[]> {
        const data = await this.db.get(`p:${presetName}`);
        if (!data) throw new Error(`Preset ${presetName} not found`);
        return JSON.parse(data);
    }

    async getAllPresets(): Promise<{ name: string, permissions: string[] }[]> {
        const presets: { name: string, permissions: string[] }[] = [];
        const cursor = this.db.openCursor();
        
        for (let key = cursor.goToRange('p:'); key; key = cursor.goToNext()) {
            if (!key.startsWith('p:')) break;
            
            presets.push({
                name: key.substring(2),
                permissions: JSON.parse(cursor.getCurrentString())
            });
        }
        
        cursor.close();
        return presets;
    }
}