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

const MAGIC_LINK_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const ROOT_PRESET = "root";
const USER_PRESET = "user";

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
      getUserByEmail(email: string): Promise<{ id: string; email: string; preset?: string } | null>;
      getUser(userId: string): Promise<{ id: string; email: string; preset?: string } | null>;
      getAuthMethodByProvider(
        provider: string,
        providerUserId: string,
      ): Promise<{ userId: string } | null>;
      createUser(
        user: { id: string; email: string; name: string; emailVerified?: boolean; preset?: string },
      ): Promise<{ id: string; email: string; preset?: string }>;
      updateUser(
        userId: string,
        updates: { preset?: string },
      ): Promise<{ id: string; email: string; preset?: string }>;
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
          { name: "updateUser", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }, { name: "updates", type: "any", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
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
      linkPresetToUser(userId: string, presetName: string): Promise<void>;
      unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;
    }>(
      {
        serviceName: "access",
        methods: [
          { name: "emitJWT", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "addPermissionToUser", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }, { name: "permission", type: "string", optional: false, isArray: false }], returnType: "void", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "linkPresetToUser", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }, { name: "presetName", type: "string", optional: false, isArray: false }], returnType: "void", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
          { name: "unlinkPresetFromUser", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }, { name: "presetName", type: "string", optional: false, isArray: false }], returnType: "void", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
        ],
      } as any,
      { baseUrl: this.baseUrl },
    );
  }

  private normalizeEmail(email: string): string {
    return (email ?? "").trim().toLowerCase();
  }

  private presetForEmail(email: string): string {
    const rootEmail = this.normalizeEmail(process.env.ROOT_EMAIL ?? "");
    return rootEmail && this.normalizeEmail(email) === rootEmail
      ? ROOT_PRESET
      : USER_PRESET;
  }

  private normalizeSessionId(sessionId?: string): string {
    const raw = (sessionId ?? "").trim();
    if (!raw) return crypto.randomUUID();
    return raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 128) || crypto.randomUUID();
  }

  private log(event: string, payload: Record<string, unknown>): void {
    console.info(`[ms-auth] ${event}: ${JSON.stringify(payload)}`);
  }

  private parseJwtPermissions(token: string): string[] {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return [];
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
        perm?: unknown;
      };
      if (!Array.isArray(payload.perm)) return [];
      return payload.perm.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  }

  private logJwtPermissions(
    flow: "magic_link" | "password_login" | "temporary_session",
    token: string,
    context: { userId: string; email?: string; presetType?: string },
  ): void {
    const permissions = this.parseJwtPermissions(token);
    if (permissions.length === 0) {
      this.log("jwt:empty_permissions", {
        flow,
        userId: context.userId,
        email: context.email ?? null,
        presetType: context.presetType ?? null,
        permissions,
        reasonHint: flow === "magic_link"
          ? "magic_link_flow_or_missing_preset_file"
          : "check ms-access logs for permission-resolution reason",
      });
      return;
    }

    this.log("jwt:permissions", {
      flow,
      userId: context.userId,
      email: context.email ?? null,
      presetType: context.presetType ?? null,
      permissionsCount: permissions.length,
    });
  }

  private async syncAccessPreset(userId: string, preset?: string): Promise<void> {
    const resolvedPreset = preset === ROOT_PRESET ? ROOT_PRESET : USER_PRESET;
    const stalePreset = resolvedPreset === ROOT_PRESET ? USER_PRESET : ROOT_PRESET;
    const access = this.accessClient();
    this.log("syncAccessPreset:start", {
      userId,
      requestedPreset: preset ?? null,
      resolvedPreset,
      stalePreset,
    });
    await access.unlinkPresetFromUser(userId, stalePreset);
    await access.linkPresetToUser(userId, resolvedPreset);
    this.log("syncAccessPreset:done", {
      userId,
      linkedPreset: resolvedPreset,
      unlinkedPreset: stalePreset,
    });
  }

  private async ensureUserByEmail(email: string): Promise<{ id: string; email: string; preset?: string }> {
    const identity = this.identityClient();
    const normalizedEmail = this.normalizeEmail(email);
    const desiredPreset = this.presetForEmail(normalizedEmail);
    this.log("ensureUserByEmail:start", {
      email: normalizedEmail,
      desiredPreset,
      rootEmailConfigured: Boolean(this.normalizeEmail(process.env.ROOT_EMAIL ?? "")),
    });
    let user = await identity.getUserByEmail(normalizedEmail);
    if (user) {
      this.log("ensureUserByEmail:found", {
        userId: user.id,
        email: user.email,
        currentPreset: user.preset ?? null,
        desiredPreset,
      });
      if (user.preset !== desiredPreset) {
        user = await identity.updateUser(user.id, { preset: desiredPreset });
        this.log("ensureUserByEmail:presetUpdated", {
          userId: user.id,
          newPreset: user.preset ?? desiredPreset,
        });
      }
      await this.syncAccessPreset(user.id, user.preset ?? desiredPreset);
      return user;
    }
    user = await identity.createUser({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0] || "User",
      preset: desiredPreset,
    });
    this.log("ensureUserByEmail:created", {
      userId: user.id,
      email: user.email,
      preset: user.preset ?? desiredPreset,
    });
    await this.syncAccessPreset(user.id, user.preset ?? desiredPreset);
    return user;
  }

  @Access("public")
  async getMagicLink(email: string, returnTo?: string): Promise<GetMagicLinkResult> {
    await this.ready();
    const normalizedEmail = this.normalizeEmail(email);
    const expiresAt = Date.now() + MAGIC_LINK_TTL_MS;
    const token = crypto.randomUUID();
    this.stores.tokens.createMagicLink({
      token,
      email: normalizedEmail,
      returnTo,
      expiresAt,
      used: false,
    });
    this.log("getMagicLink:created", {
      email: normalizedEmail,
      returnTo: returnTo ?? null,
      tokenPrefix: token.slice(0, 8),
      expiresAt,
      ttlMs: MAGIC_LINK_TTL_MS,
    });
    return { ok: true, token, expiresAt };
  }

  @Access("public")
  async verifyLink(token: string): Promise<VerifyLinkResult> {
    await this.ready();
    const magicLink = this.stores.tokens.getMagicLink(token);
    if (!magicLink) {
      this.log("verifyLink:failed", {
        tokenPrefix: token.slice(0, 8),
        reason: "magic_link_not_found",
      });
      throw new Error("Invalid or expired magic link");
    }
    if (magicLink.expiresAt < Date.now()) {
      this.log("verifyLink:failed", {
        tokenPrefix: token.slice(0, 8),
        reason: "magic_link_expired",
        expiresAt: magicLink.expiresAt,
      });
      throw new Error("Invalid or expired magic link");
    }
    this.log("verifyLink:start", {
      tokenPrefix: token.slice(0, 8),
      email: magicLink.email,
      returnTo: magicLink.returnTo ?? null,
    });
    const user = await this.ensureUserByEmail(magicLink.email);
    const jwt = await this.accessClient().emitJWT(user.id);
    this.logJwtPermissions("magic_link", jwt, {
      userId: user.id,
      email: magicLink.email,
      presetType: user.preset,
    });
    this.log("verifyLink:jwtIssued", {
      userId: user.id,
      email: magicLink.email,
      tokenPrefix: token.slice(0, 8),
      jwtIssued: true,
    });
    return { token: jwt, userId: user.id, email: magicLink.email, returnTo: magicLink.returnTo };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    await this.ready();
    if (!password || !password.trim()) {
      throw new Error("Password is required");
    }
    const user = await this.ensureUserByEmail(email);
    const token = await this.accessClient().emitJWT(user.id);
    this.logJwtPermissions("password_login", token, {
      userId: user.id,
      email: user.email,
      presetType: user.preset,
    });
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
    this.logJwtPermissions("temporary_session", token, {
      userId: resolvedUser.id,
      email: resolvedUser.email,
      presetType: resolvedUser.preset,
    });
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
