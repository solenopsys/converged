

export type Permission = string;





export interface AccesService {
    emitJWT(userId: string): Promise<string>
    // user permissions
   
    addPermissionToUser(userId: string, permission: Permission): Promise<void>
    removePermissionFromUser(userId: string, permission: Permission): Promise<void>
    getPermissionsFromUser(userId: string): Promise<Permission[]>
    getPermissionsMixinFromUser(userId: string): Promise<Permission[]>
    // user presets
    linkPresetToUser(userId: string, presetName: string): Promise<void>
    unlinkPresetFromUser(userId: string, presetName: string): Promise<void>
    // presets
    createPreset(presetName: string, permissions: Permission[]): Promise<void>
    updatePreset(presetName: string, permissions: Permission[]): Promise<void>
    deletePreset(presetName: string): Promise<void>
    getPreset(presetName: string): Promise<Permission[]>
    getAllPresets(): Promise<{ name: string, permissions: Permission[] }[]>
}

