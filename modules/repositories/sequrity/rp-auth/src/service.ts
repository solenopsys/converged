import type {
  AuthService,
  OAuthClient,
  OAuthClientInput,
  OAuthClientUpdate,
  GetMagicLinkResult,
  MagicLinkIdentity,
  CleanupResult,
  RefreshSessionResult,
} from "./types";
import { Access, getCurrentWorkspaceContext } from "nrpc";
import { serviceError } from "back-core";
import { createHash } from "node:crypto";
import { StoresController } from "./stores";

const MAGIC_LINK_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// This service owns only auth-local state: magic links and refresh tokens.
// User lookup, permissions and JWT signing are orchestrated by the UI gateway,
// so no microservice calls another microservice.
export class AuthServiceImpl implements AuthService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.stores = new StoresController("rp-auth");
      await this.stores.init();
    })();
    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  private normalizeEmail(email: string): string {
    return (email ?? "").trim().toLowerCase();
  }

  private hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("base64url");
  }

  private refreshScope(): string {
    const scope = getCurrentWorkspaceContext()?.scope
      ?? process.env.STORAGE_SCOPE
      ?? process.env.ACCESS_JWT_SCOPE
      ?? "";
    if (!scope.trim()) throw new Error("storage scope is required for refresh token issuance");
    return scope;
  }

  private issueRefreshSession(userId: string, clientId = "browser"): RefreshSessionResult {
    const refreshToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    this.stores.tokens.createRefreshToken({
      tokenHash: this.hashRefreshToken(refreshToken),
      userId,
      clientId,
      scope: this.refreshScope(),
      expiresAt: Date.now() + REFRESH_TTL_MS,
      revoked: false,
    });
    return { userId, clientId, refreshToken };
  }

  @Access("internal")
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
    return { ok: true, token, expiresAt };
  }

  @Access("internal")
  async consumeMagicLink(token: string): Promise<MagicLinkIdentity> {
    await this.ready();
    const magicLink = this.stores.tokens.getMagicLink(token);
    if (!magicLink || magicLink.used || magicLink.expiresAt < Date.now()) {
      throw new Error("Invalid or expired magic link");
    }
    this.stores.tokens.markMagicLinkAsUsed(token);
    return { email: magicLink.email, returnTo: magicLink.returnTo };
  }

  @Access("internal")
  async createRefreshSession(userId: string, clientId?: string): Promise<RefreshSessionResult> {
    await this.ready();
    if (!userId.trim()) throw new Error("userId is required");
    return this.issueRefreshSession(userId, clientId);
  }

  @Access("internal")
  async logout(userId: string, clientId?: string): Promise<void> {
    await this.ready();
    this.stores.tokens.revokeAllUserTokens(userId, clientId);
  }

  @Access("internal")
  async refreshSession(refreshToken: string): Promise<RefreshSessionResult> {
    await this.ready();
    const tokenHash = this.hashRefreshToken(refreshToken ?? "");
    const record = this.stores.tokens.getRefreshToken(tokenHash);
    if (!record || record.revoked || record.expiresAt <= Date.now()) {
      // A missing or spent refresh token is an expected unauthenticated state,
      // not an application failure. The gateway clears the browser cookie.
      throw serviceError(401, "Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }
    this.stores.tokens.revokeRefreshToken(tokenHash);
    return this.issueRefreshSession(record.userId, record.clientId);
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
    return {
      authCodes: this.stores.tokens.cleanupExpiredAuthCodes(),
      magicLinks: this.stores.tokens.cleanupExpiredMagicLinks(),
      refreshTokens: this.stores.tokens.cleanupExpiredRefreshTokens(),
    };
  }
}

export default AuthServiceImpl;
