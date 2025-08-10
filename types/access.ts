
export interface AccesService {
    // user permissions
    addPermissionToUser(userId: string, permission: string): Promise<void>
    removePermissionFromUser(userId: string, permission: string): Promise<void>
    getPermissionsFromUser(userId: string): Promise<string[]>
    getPermissionsMixinFromUser(userId: string): Promise<string[]>
    // user presets
    linkPresetToUser(userId: string, presetName: string): Promise<void>
    unlinkPresetFromUser(userId: string, presetName: string): Promise<void>

    // presets
    createPreset(presetName: string, permissions: string[]): Promise<void>
    updatePreset(presetName: string, permissions: string[]): Promise<void>
    deletePreset(presetName: string): Promise<void>
    getPreset(presetName: string): Promise<string[]>
    getAllPresets(): Promise<{ name: string, permissions: string[] }[]>
}

