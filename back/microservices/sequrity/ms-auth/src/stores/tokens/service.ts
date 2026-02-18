import { KVStore } from "back-core";
import {
  AuthCodeRepository,
  AuthCodeKey,
  AuthCodeValue,
  RefreshTokenRepository,
  RefreshTokenKey,
  RefreshTokenValue,
  RefreshUserRepository,
  RefreshUserKey,
  RefreshUserValue,
  MagicLinkRepository,
  MagicLinkKey,
  MagicLinkValue,
  REFRESH_USER_PREFIX,
} from "./entities";

export class TokensStoreService {
  private readonly authCodeRepo: AuthCodeRepository;
  private readonly refreshRepo: RefreshTokenRepository;
  private readonly refreshUserRepo: RefreshUserRepository;
  private readonly magicLinkRepo: MagicLinkRepository;

  constructor(private store: KVStore) {
    this.authCodeRepo = new AuthCodeRepository(store);
    this.refreshRepo = new RefreshTokenRepository(store);
    this.refreshUserRepo = new RefreshUserRepository(store);
    this.magicLinkRepo = new MagicLinkRepository(store);
  }

  createAuthCode(authCode: AuthCodeValue): void {
    this.authCodeRepo.save(new AuthCodeKey(authCode.code), authCode);
  }

  getAuthCode(code: string): AuthCodeValue | null {
    return this.authCodeRepo.get(new AuthCodeKey(code)) ?? null;
  }

  markAuthCodeAsUsed(code: string): void {
    const authCode = this.getAuthCode(code);
    if (!authCode) {
      return;
    }
    authCode.used = true;
    this.authCodeRepo.save(new AuthCodeKey(code), authCode);
  }

  deleteAuthCode(code: string): void {
    this.authCodeRepo.delete(new AuthCodeKey(code));
  }

  createRefreshToken(token: RefreshTokenValue): void {
    this.refreshRepo.save(new RefreshTokenKey(token.tokenHash), token);
    this.refreshUserRepo.save(
      new RefreshUserKey(token.userId, token.clientId, token.tokenHash),
      { tokenHash: token.tokenHash } as RefreshUserValue,
    );
  }

  getRefreshToken(tokenHash: string): RefreshTokenValue | null {
    return this.refreshRepo.get(new RefreshTokenKey(tokenHash)) ?? null;
  }

  revokeRefreshToken(tokenHash: string): void {
    const token = this.getRefreshToken(tokenHash);
    if (!token) {
      return;
    }
    token.revoked = true;
    this.refreshRepo.save(new RefreshTokenKey(tokenHash), token);
  }

  revokeAllUserTokens(userId: string, clientId?: string): number {
    const prefix = clientId
      ? [REFRESH_USER_PREFIX, userId, clientId]
      : [REFRESH_USER_PREFIX, userId];
    const keys = this.store.listKeys(prefix);
    let revoked = 0;

    keys.forEach((key) => {
      const tokenHash = key.split(":").pop();
      if (!tokenHash) {
        return;
      }
      const token = this.getRefreshToken(tokenHash);
      if (token && !token.revoked) {
        token.revoked = true;
        this.refreshRepo.save(new RefreshTokenKey(tokenHash), token);
        revoked += 1;
      }
    });

    return revoked;
  }

  createMagicLink(magicLink: MagicLinkValue): void {
    this.magicLinkRepo.save(new MagicLinkKey(magicLink.token), magicLink);
  }

  getMagicLink(token: string): MagicLinkValue | null {
    return this.magicLinkRepo.get(new MagicLinkKey(token)) ?? null;
  }

  markMagicLinkAsUsed(token: string): void {
    const magicLink = this.getMagicLink(token);
    if (!magicLink) {
      return;
    }
    magicLink.used = true;
    this.magicLinkRepo.save(new MagicLinkKey(token), magicLink);
  }

  deleteMagicLink(token: string): void {
    this.magicLinkRepo.delete(new MagicLinkKey(token));
  }

  cleanupExpiredAuthCodes(): number {
    const now = Date.now();
    const keys = this.authCodeRepo.listKeys();
    let deleted = 0;

    keys.forEach((key) => {
      const authCode = this.authCodeRepo.getDirect(key);
      if (authCode && authCode.expiresAt < now) {
        this.deleteAuthCode(authCode.code);
        deleted += 1;
      }
    });

    return deleted;
  }

  cleanupExpiredMagicLinks(): number {
    const now = Date.now();
    const keys = this.magicLinkRepo.listKeys();
    let deleted = 0;

    keys.forEach((key) => {
      const magicLink = this.magicLinkRepo.getDirect(key);
      if (magicLink && magicLink.expiresAt < now) {
        this.deleteMagicLink(magicLink.token);
        deleted += 1;
      }
    });

    return deleted;
  }

  cleanupExpiredRefreshTokens(): number {
    const now = Date.now();
    const keys = this.refreshRepo.listKeys();
    let deleted = 0;

    keys.forEach((key) => {
      const token = this.refreshRepo.getDirect(key);
      if (token && token.expiresAt < now) {
        this.refreshRepo.delete(new RefreshTokenKey(token.tokenHash));
        this.refreshUserRepo.delete(
          new RefreshUserKey(token.userId, token.clientId, token.tokenHash),
        );
        deleted += 1;
      }
    });

    return deleted;
  }
}
