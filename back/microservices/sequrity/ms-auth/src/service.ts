import type {
  AuthService,
  OAuthClient,
  OAuthClientInput,
  OAuthClientUpdate,
  GetMagicLinkResult,
  VerifyLinkResult,
  LoginResult,
  TemporaryUserResult,
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
      getUser(userId: string): Promise<{ id: string; email: string } | null>;
      getAuthMethodByProvider(
        provider: string,
        providerUserId: string,
      ): Promise<{ userId: string } | null>;
      createUser(
        user: { id: string; email: string; name: string; emailVerified?: boolean },
      ): Promise<{ id: string; email: string }>;
      linkAuthMethod(
        userId: string,
        provider: string,
        providerUserId: string,
        email: string,
      ): Promise<void>;
    }>(
      {
        serviceName: "identity",
        methods: [
          { name: "getUserByEmail", parameters: [{ name: "email", type: "string", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "getUser", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "getAuthMethodByProvider", parameters: [{ name: "provider", type: "string", optional: false, isArray: false }, { name: "providerUserId", type: "string", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "createUser", parameters: [{ name: "user", type: "any", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "linkAuthMethod", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }, { name: "provider", type: "string", optional: false, isArray: false }, { name: "providerUserId", type: "string", optional: false, isArray: false }, { name: "email", type: "string", optional: false, isArray: false }], returnType: "void", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
        ],
      } as any,
      { baseUrl: this.baseUrl },
    );
  }

  private accessClient() {
    return createHttpClient<{
      emitJWT(userId: string): Promise<string>;
      addPermissionToUser(userId: string, permission: string): Promise<void>;
    }>(
      {
        serviceName: "access",
        methods: [
          { name: "emitJWT", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "addPermissionToUser", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }, { name: "permission", type: "string", optional: false, isArray: false }], returnType: "void", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
        ],
      } as any,
      { baseUrl: this.baseUrl },
    );
  }

  private normalizeEmail(email: string): string {
    return (email ?? "").trim().toLowerCase();
  }

  private normalizeSessionId(sessionId?: string): string {
    const raw = (sessionId ?? "").trim();
    if (!raw) return crypto.randomUUID();
    return raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 128) || crypto.randomUUID();
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

  @Access("public")
  async verifyLink(token: string): Promise<VerifyLinkResult> {
    await this.ready();
    const magicLink = this.stores.tokens.getMagicLink(token);
    if (!magicLink || magicLink.used || magicLink.expiresAt < Date.now()) {
      throw new Error("Invalid or expired magic link");
    }
    this.stores.tokens.markMagicLinkAsUsed(token);
    const user = await this.ensureUserByEmail(magicLink.email);
    const jwt = await this.accessClient().emitJWT(user.id);
    return { token: jwt, userId: user.id, email: magicLink.email, returnTo: magicLink.returnTo };
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

  @Access("public")
  async createTemporaryUser(sessionId?: string): Promise<TemporaryUserResult> {
    await this.ready();
    const identity = this.identityClient();
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const provider = "temporary";

    const existing = await identity.getAuthMethodByProvider(provider, normalizedSessionId);
    const user = existing
      ? await identity.getUser(existing.userId)
      : null;

    const resolvedUser = user ?? await identity.createUser({
      id: `temp:${crypto.randomUUID()}`,
      email: `temp+${normalizedSessionId}@guest.local`,
      name: "Guest",
      emailVerified: false,
    });

    if (!existing) {
      await identity.linkAuthMethod(
        resolvedUser.id,
        provider,
        normalizedSessionId,
        resolvedUser.email,
      );
    }

    const access = this.accessClient();
    await access.addPermissionToUser(resolvedUser.id, "usage/recordUsage(w)");
    const token = await access.emitJWT(resolvedUser.id);
    return {
      token,
      userId: resolvedUser.id,
      email: resolvedUser.email,
      temporary: true,
    };
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
