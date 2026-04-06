import type { IdentityService, User, UserInput, UserUpdate, AuthMethod } from "./types";
import { StoresController } from "./stores";

export class IdentityServiceImpl implements IdentityService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      this.stores = new StoresController("identity-ms");
      await this.stores.init();
    })();
    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async createUser(user: UserInput): Promise<User> {
    await this.ready();
    return this.stores.users.createUser(user);
  }

  async listUsers(): Promise<User[]> {
    await this.ready();
    return this.stores.users.listUsers();
  }

  async getUser(userId: string): Promise<User | null> {
    await this.ready();
    return this.stores.users.getUser(userId);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    await this.ready();
    return this.stores.users.getUserByEmail(email);
  }

  async updateUser(userId: string, updates: UserUpdate): Promise<User> {
    await this.ready();
    return this.stores.users.updateUser(userId, updates);
  }

  async deleteUser(userId: string): Promise<boolean> {
    await this.ready();
    return this.stores.users.deleteUser(userId);
  }

  async linkAuthMethod(
    userId: string,
    provider: string,
    providerUserId: string,
    email: string,
  ): Promise<void> {
    await this.ready();
    await this.stores.users.linkAuthMethod(userId, provider, providerUserId, email);
  }

  async unlinkAuthMethod(userId: string, provider: string): Promise<void> {
    await this.ready();
    await this.stores.users.unlinkAuthMethod(userId, provider);
  }

  async getAuthMethodByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<AuthMethod | null> {
    await this.ready();
    return this.stores.users.getAuthMethodByProvider(provider, providerUserId);
  }

  async getUserAuthMethods(userId: string): Promise<AuthMethod[]> {
    await this.ready();
    return this.stores.users.getUserAuthMethods(userId);
  }
}

export default IdentityServiceImpl;
