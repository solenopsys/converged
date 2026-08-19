import { PrefixedRepositoryKV, SimpleKey, PrefixKey, KeyKV } from "back-core";

const AUTH_CODE_PREFIX = "auth_code";
class AuthCodeKey extends SimpleKey {
  readonly prefix = AUTH_CODE_PREFIX;
}

export type AuthCodeValue = {
  code: string;
  clientId: string;
  userId: string;
  codeChallenge?: string;
  expiresAt: number;
  used: boolean;
};

class AuthCodeRepository extends PrefixedRepositoryKV<AuthCodeKey, AuthCodeValue> {
  getPrefix(): string[] {
    return [AUTH_CODE_PREFIX];
  }
}

const REFRESH_PREFIX = "refresh";
class RefreshTokenKey extends SimpleKey {
  readonly prefix = REFRESH_PREFIX;
}

export type RefreshTokenValue = {
  tokenHash: string;
  userId: string;
  clientId: string;
  scope: string;
  expiresAt: number;
  revoked: boolean;
};

class RefreshTokenRepository extends PrefixedRepositoryKV<
  RefreshTokenKey,
  RefreshTokenValue
> {
  getPrefix(): string[] {
    return [REFRESH_PREFIX];
  }
}

const REFRESH_USER_PREFIX = "refresh_user";
class RefreshUserKey extends PrefixKey implements KeyKV {
  readonly prefix = REFRESH_USER_PREFIX;

  constructor(
    private userId: string,
    private clientId: string,
    private tokenHash: string,
  ) {
    super();
  }

  build(): string[] {
    return [this.prefix, this.userId, this.clientId, this.tokenHash];
  }
}

export type RefreshUserValue = {
  tokenHash: string;
};

class RefreshUserRepository extends PrefixedRepositoryKV<
  RefreshUserKey,
  RefreshUserValue
> {
  getPrefix(): string[] {
    return [REFRESH_USER_PREFIX];
  }
}

const MAGIC_PREFIX = "magic";
class MagicLinkKey extends SimpleKey {
  readonly prefix = MAGIC_PREFIX;
}

export type MagicLinkValue = {
  token: string;
  email: string;
  returnTo?: string;
  expiresAt: number;
  used: boolean;
};

class MagicLinkRepository extends PrefixedRepositoryKV<
  MagicLinkKey,
  MagicLinkValue
> {
  getPrefix(): string[] {
    return [MAGIC_PREFIX];
  }
}

export {
  AUTH_CODE_PREFIX,
  AuthCodeKey,
  AuthCodeRepository,
  REFRESH_PREFIX,
  RefreshTokenKey,
  RefreshTokenRepository,
  REFRESH_USER_PREFIX,
  RefreshUserKey,
  RefreshUserRepository,
  MAGIC_PREFIX,
  MagicLinkKey,
  MagicLinkRepository,
};
