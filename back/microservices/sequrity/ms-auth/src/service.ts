import type {
  AuthService,
  OAuthClient,
  OAuthClientInput,
  OAuthClientUpdate,
  GetMagicLinkResult,
  VerifyLinkResult,
  LoginResult,
  CleanupResult,
} from "./types";
import { createHttpClient, Access } from "nrpc";
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

  private get baseUrl(): string {
    return (
      (typeof process !== "undefined" && process.env?.SERVICES_BASE) ||
      "http://127.0.0.1:3000/services"
    );
  }

  private identityClient() {
    return createHttpClient<{
      getUserByEmail(email: string): Promise<{ id: string; email: string } | null>;
      createUser(user: { id: string; email: string; name: string }): Promise<{ id: string; email: string }>;
    }>(
      {
        serviceName: "identity",
        methods: [
          { name: "getUserByEmail", parameters: [{ name: "email", type: "string", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "createUser", parameters: [{ name: "user", type: "any", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
        ],
      } as any,
      { baseUrl: this.baseUrl },
    );
  }

  private accessClient() {
    return createHttpClient<{ emitJWT(userId: string): Promise<string> }>(
      {
        serviceName: "access",
        methods: [
          { name: "emitJWT", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
        ],
      } as any,
      { baseUrl: this.baseUrl },
    );
  }

  private normalizeEmail(email: string): string {
    return (email ?? "").trim().toLowerCase();
  }

  private async ensureUserByEmail(email: string): Promise<{ id: string; email: string }> {
    const identity = this.identityClient();
    const normalizedEmail = this.normalizeEmail(email);
    let user = await identity.getUserByEmail(normalizedEmail);
    if (user) return user;
    user = await identity.createUser({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0] || "User",
    });
    return user;
  }

  @Access("public")
  async getMagicLink(email: string, returnTo?: string): Promise<GetMagicLinkResult> {
    await this.ready();
    const normalizedEmail = this.normalizeEmail(email);
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const token = crypto.randomUUID();
    this.stores.tokens.createMagicLink({
      token,
      email: normalizedEmail,
      returnTo,
      expiresAt,
      used: false,
    });
    return { ok: true, token, expiresAt };
  }

  async verifyLink(token: string): Promise<VerifyLinkResult> {
    await this.ready();
    const magicLink = this.stores.tokens.getMagicLink(token);
    if (!magicLink || magicLink.used || magicLink.expiresAt < Date.now()) {
      throw new Error("Invalid or expired magic link");
    }
    this.stores.tokens.markMagicLinkAsUsed(token);
    const identity = this.identityClient();
    const user = await identity.getUserByEmail(magicLink.email);
    if (!user) {
      throw new Error("User not found");
    }
    return { userId: user.id, email: magicLink.email, returnTo: magicLink.returnTo };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    await this.ready();
    if (!password || !password.trim()) {
      throw new Error("Password is required");
    }
    const user = await this.ensureUserByEmail(email);
    const token = await this.accessClient().emitJWT(user.id);
    return { token, userId: user.id, email: user.email };
  }

  async logout(userId: string, clientId?: string): Promise<void> {
    await this.ready();
    this.stores.tokens.revokeAllUserTokens(userId, clientId);
  }

  async createOAuthClient(client: OAuthClientInput): Promise<OAuthClient> {
    await this.ready();
    return this.stores.clients.createOAuthClient(client);
  }

  async getOAuthClient(clientId: string): Promise<OAuthClient | null> {
    await this.ready();
    return this.stores.clients.getOAuthClient(clientId);
  }

  async updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient> {
    await this.ready();
    return this.stores.clients.updateOAuthClient(clientId, updates);
  }

  async listOAuthClients(): Promise<OAuthClient[]> {
    await this.ready();
    return this.stores.clients.listOAuthClients();
  }

  async deleteOAuthClient(clientId: string): Promise<boolean> {
    await this.ready();
    return this.stores.clients.deleteOAuthClient(clientId);
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
