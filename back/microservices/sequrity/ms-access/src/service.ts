import type { AccessService, AccessPreset, Permission } from "./types";
import { StoresController } from "./stores";

const DEFAULT_TTL_SECONDS = 15 * 60;
export class AccessServiceImpl implements AccessService {
  private stores: StoresController;
  private initPromise?: Promise<void>;
  private jwtSecret: string;
  private ttlSeconds: number;

  constructor(config: { jwtSecret?: string; ttlSeconds?: number } = {}) {
    const secret = config.jwtSecret ?? process.env.ACCESS_JWT_SECRET;
    if (!secret) {
      throw new Error("ACCESS_JWT_SECRET environment variable is required");
    }
    this.jwtSecret = secret;
    const envTtl = process.env.ACCESS_JWT_TTL
      ? Number(process.env.ACCESS_JWT_TTL)
      : undefined;
    this.ttlSeconds = config.ttlSeconds ?? envTtl ?? DEFAULT_TTL_SECONDS;
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      this.stores = new StoresController("access-ms");
      await this.stores.init();
    })();
    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async emitJWT(userId: string): Promise<string> {
    await this.ready();
    const permissions = await this.getPermissionsMixinFromUser(userId);
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.ttlSeconds;
    return await Bun.sign(
      {
        sub: userId,
        perm: permissions,
        iat: now,
        exp,
      },
      this.jwtSecret,
    );
  }

  async addPermissionToUser(
    userId: string,
    permission: Permission,
  ): Promise<void> {
    await this.ready();
    this.stores.access.addPermissionToUser(userId, permission);
  }

  async removePermissionFromUser(
    userId: string,
    permission: Permission,
  ): Promise<void> {
    await this.ready();
    this.stores.access.removePermissionFromUser(userId, permission);
  }

  async getPermissionsFromUser(userId: string): Promise<Permission[]> {
    await this.ready();
    return this.stores.access.getPermissionsFromUser(userId);
  }

  async getPermissionsMixinFromUser(userId: string): Promise<Permission[]> {
    await this.ready();
    const access = this.stores.access.getUserAccess(userId);
    const permissions = new Set(access.permissions);

    for (const presetName of access.presets) {
      const presetPerms = this.stores.access.getPermissionsFromPreset(
        presetName,
      );
      presetPerms.forEach((perm) => permissions.add(perm));
    }

    return [...permissions];
  }

  async linkPresetToUser(userId: string, presetName: string): Promise<void> {
    await this.ready();
    this.stores.access.linkPresetToUser(userId, presetName);
  }

  async unlinkPresetFromUser(userId: string, presetName: string): Promise<void> {
    await this.ready();
    this.stores.access.unlinkPresetFromUser(userId, presetName);
  }

  async createPreset(presetName: string, permissions: Permission[]): Promise<void> {
    await this.ready();
    this.stores.access.createPreset(presetName, permissions);
  }

  async updatePreset(presetName: string, permissions: Permission[]): Promise<void> {
    await this.ready();
    this.stores.access.updatePreset(presetName, permissions);
  }

  async deletePreset(presetName: string): Promise<void> {
    await this.ready();
    this.stores.access.deletePreset(presetName);
  }

  async getPreset(presetName: string): Promise<Permission[] | null> {
    await this.ready();
    const permissions = this.stores.access.getPermissionsFromPreset(presetName);
    return permissions.length > 0 ? permissions : null;
  }

  async getAllPresets(): Promise<AccessPreset[]> {
    await this.ready();
    const presets = this.stores.access.getPresets();
    return presets.map((name) => ({
      name,
      permissions: this.stores.access.getPermissionsFromPreset(name),
    }));
  }
}

export default AccessServiceImpl;
