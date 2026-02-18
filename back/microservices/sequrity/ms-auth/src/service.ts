import type {
  AuthService,
  User,
  UserInput,
  UserUpdate,
  AuthMethod,
  OAuthClient,
  OAuthClientInput,
  OAuthClientUpdate,
  AuthCode,
  AuthCodeInput,
  RefreshToken,
  MagicLink,
  MagicLinkInput,
  CleanupResult,
} from "./types";
import { StoresController } from "./stores";

export class AuthServiceImpl implements AuthService {
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
      this.stores = new StoresController("auth-ms");
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
    await this.stores.users.linkAuthMethod(
      userId,
      provider,
      providerUserId,
      email,
    );
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

  async createOAuthClient(client: OAuthClientInput): Promise<OAuthClient> {
    await this.ready();
    return this.stores.users.createOAuthClient(client);
  }

  async updateOAuthClient(
    clientId: string,
    updates: OAuthClientUpdate,
  ): Promise<OAuthClient> {
    await this.ready();
    return this.stores.users.updateOAuthClient(clientId, updates);
  }

  async getOAuthClient(clientId: string): Promise<OAuthClient | null> {
    await this.ready();
    return this.stores.users.getOAuthClient(clientId);
  }

  async listOAuthClients(): Promise<OAuthClient[]> {
    await this.ready();
    return this.stores.users.listOAuthClients();
  }

  async deleteOAuthClient(clientId: string): Promise<boolean> {
    await this.ready();
    return this.stores.users.deleteOAuthClient(clientId);
  }

  async createAuthCode(authCode: AuthCodeInput): Promise<void> {
    await this.ready();
    this.stores.tokens.createAuthCode({
      ...authCode,
      used: authCode.used ?? false,
    });
  }

  async getAuthCode(code: string): Promise<AuthCode | null> {
    await this.ready();
    return this.stores.tokens.getAuthCode(code);
  }

  async markAuthCodeAsUsed(code: string): Promise<void> {
    await this.ready();
    this.stores.tokens.markAuthCodeAsUsed(code);
  }

  async deleteAuthCode(code: string): Promise<void> {
    await this.ready();
    this.stores.tokens.deleteAuthCode(code);
  }

  async createRefreshToken(
    userId: string,
    clientId: string,
    tokenHash: string,
    scope: string,
    expiresAt: number,
  ): Promise<void> {
    await this.ready();
    this.stores.tokens.createRefreshToken({
      tokenHash,
      userId,
      clientId,
      scope,
      expiresAt,
      revoked: false,
    });
  }

  async getRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    await this.ready();
    return this.stores.tokens.getRefreshToken(tokenHash);
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.ready();
    this.stores.tokens.revokeRefreshToken(tokenHash);
  }

  async revokeAllUserTokens(userId: string, clientId?: string): Promise<number> {
    await this.ready();
    return this.stores.tokens.revokeAllUserTokens(userId, clientId);
  }

  async createMagicLink(magicLink: MagicLinkInput): Promise<void> {
    await this.ready();
    this.stores.tokens.createMagicLink({
      ...magicLink,
      used: magicLink.used ?? false,
    });
  }

  async getMagicLink(token: string): Promise<MagicLink | null> {
    await this.ready();
    return this.stores.tokens.getMagicLink(token);
  }

  async markMagicLinkAsUsed(token: string): Promise<void> {
    await this.ready();
    this.stores.tokens.markMagicLinkAsUsed(token);
  }

  async cleanupExpired(): Promise<CleanupResult> {
    await this.ready();
    const authCodes = this.stores.tokens.cleanupExpiredAuthCodes();
    const magicLinks = this.stores.tokens.cleanupExpiredMagicLinks();
    const refreshTokens = this.stores.tokens.cleanupExpiredRefreshTokens();
    return { authCodes, magicLinks, refreshTokens };
  }
}

export default AuthServiceImpl;
