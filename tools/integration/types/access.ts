export type Permission = string;

export interface AccessPreset {
  name: string;
  permissions: Permission[];
}

export interface AccessService {
  emitJWT(userId: string): Promise<string>;

  addPermissionToUser(userId: string, permission: Permission): Promise<void>;
  removePermissionFromUser(userId: string, permission: Permission): Promise<void>;
  getPermissionsFromUser(userId: string): Promise<Permission[]>;
  getPermissionsMixinFromUser(userId: string): Promise<Permission[]>;

  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;

  createPreset(presetName: string, permissions: Permission[]): Promise<void>;
  updatePreset(presetName: string, permissions: Permission[]): Promise<void>;
  deletePreset(presetName: string): Promise<void>;
  getPreset(presetName: string): Promise<Permission[] | null>;
  getAllPresets(): Promise<AccessPreset[]>;
}
