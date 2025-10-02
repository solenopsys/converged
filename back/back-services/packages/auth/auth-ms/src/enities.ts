import { PrefixedRepositoryKV, SimpleKey } from "back-core";

// ========== 1. USERS ==========
const USER_PREFIX = "user";
class UserKey extends SimpleKey {
    readonly prefix = USER_PREFIX;
}

type UserValue = {
    id: string;
    email: string;
    name: string;
    picture?: string;
    email_verified: boolean;
    created_at: number;
};

class UserRepository extends PrefixedRepositoryKV<UserKey, UserValue> {
    getPrefix(): string[] {
        return [USER_PREFIX];
    }
}

export { USER_PREFIX, UserKey, UserRepository, type UserValue };

// ========== USER BY EMAIL INDEX ==========
const USER_BY_EMAIL_PREFIX = "user_by_email";
class UserByEmailKey extends SimpleKey {
    readonly prefix = USER_BY_EMAIL_PREFIX;
}

type UserByEmailValue = string; // user_id

class UserByEmailRepository extends PrefixedRepositoryKV<UserByEmailKey, UserByEmailValue> {
    getPrefix(): string[] {
        return [USER_BY_EMAIL_PREFIX];
    }
}

export { USER_BY_EMAIL_PREFIX, UserByEmailKey, UserByEmailRepository, type UserByEmailValue };

// ========== 2. AUTH METHODS ==========
const AUTH_PREFIX = "auth";
class AuthKey extends SimpleKey {
    readonly prefix = AUTH_PREFIX;
    
    constructor(provider: string, providerUserId: string) {
        super(`${provider}:${providerUserId}`);
    }
}

type AuthMethodValue = {
    user_id: string;
    email: string;
    last_used_at: number;
};

class AuthMethodRepository extends PrefixedRepositoryKV<AuthKey, AuthMethodValue> {
    getPrefix(): string[] {
        return [AUTH_PREFIX];
    }
}

export { AUTH_PREFIX, AuthKey, AuthMethodRepository, type AuthMethodValue };

// ========== USER AUTH INDEX ==========
const USER_AUTH_PREFIX = "user_auth";
class UserAuthKey extends SimpleKey {
    readonly prefix = USER_AUTH_PREFIX;
    
    constructor(userId: string, provider: string) {
        super(`${userId}:${provider}`);
    }
}

type UserAuthValue = {
    provider_user_id: string;
    email: string;
    last_used_at: number;
};

class UserAuthRepository extends PrefixedRepositoryKV<UserAuthKey, UserAuthValue> {
    getPrefix(): string[] {
        return [USER_AUTH_PREFIX];
    }
}

export { USER_AUTH_PREFIX, UserAuthKey, UserAuthRepository, type UserAuthValue };

// ========== 3. OAUTH CLIENTS ==========
const OAUTH_CLIENT_PREFIX = "client";
class OAuthClientKey extends SimpleKey {
    readonly prefix = OAUTH_CLIENT_PREFIX;
}

type OAuthClientValue = {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    grant_types: string[];
    trusted: boolean;
};

class OAuthClientRepository extends PrefixedRepositoryKV<OAuthClientKey, OAuthClientValue> {
    getPrefix(): string[] {
        return [OAUTH_CLIENT_PREFIX];
    }
}

export { OAUTH_CLIENT_PREFIX, OAuthClientKey, OAuthClientRepository, type OAuthClientValue };

// ========== 4. AUTHORIZATION CODES ==========
const AUTH_CODE_PREFIX = "authcode";
class AuthCodeKey extends SimpleKey {
    readonly prefix = AUTH_CODE_PREFIX;
}

type AuthCodeValue = {
    code: string;
    client_id: string;
    user_id: string;
    code_challenge?: string;
    expires_at: number;
    used: boolean;
};

class AuthCodeRepository extends PrefixedRepositoryKV<AuthCodeKey, AuthCodeValue> {
    getPrefix(): string[] {
        return [AUTH_CODE_PREFIX];
    }
}

export { AUTH_CODE_PREFIX, AuthCodeKey, AuthCodeRepository, type AuthCodeValue };

// ========== 5. REFRESH TOKENS ==========
const REFRESH_TOKEN_PREFIX = "refresh";
class RefreshTokenKey extends SimpleKey {
    readonly prefix = REFRESH_TOKEN_PREFIX;
    
    constructor(userId: string, clientId: string, tokenHash: string) {
        super(`${userId}:${clientId}:${tokenHash}`);
    }
}

type RefreshTokenValue = {
    scope: string;
    expires_at: number;
    revoked: boolean;
};

class RefreshTokenRepository extends PrefixedRepositoryKV<RefreshTokenKey, RefreshTokenValue> {
    getPrefix(): string[] {
        return [REFRESH_TOKEN_PREFIX];
    }
}

export { REFRESH_TOKEN_PREFIX, RefreshTokenKey, RefreshTokenRepository, type RefreshTokenValue };

// ========== REFRESH TOKEN BY HASH INDEX ==========
const REFRESH_BY_HASH_PREFIX = "refresh_by_hash";
class RefreshByHashKey extends SimpleKey {
    readonly prefix = REFRESH_BY_HASH_PREFIX;
}

type RefreshByHashValue = {
    user_id: string;
    client_id: string;
};

class RefreshByHashRepository extends PrefixedRepositoryKV<RefreshByHashKey, RefreshByHashValue> {
    getPrefix(): string[] {
        return [REFRESH_BY_HASH_PREFIX];
    }
}

export { REFRESH_BY_HASH_PREFIX, RefreshByHashKey, RefreshByHashRepository, type RefreshByHashValue };

// ========== 6. MAGIC LINK TOKENS ==========
const MAGIC_LINK_PREFIX = "magic";
class MagicLinkKey extends SimpleKey {
    readonly prefix = MAGIC_LINK_PREFIX;
}

type MagicLinkValue = {
    token: string;
    email: string;
    return_to?: string;
    expires_at: number;
    used: boolean;
};

class MagicLinkRepository extends PrefixedRepositoryKV<MagicLinkKey, MagicLinkValue> {
    getPrefix(): string[] {
        return [MAGIC_LINK_PREFIX];
    }
}

export { MAGIC_LINK_PREFIX, MagicLinkKey, MagicLinkRepository, type MagicLinkValue };