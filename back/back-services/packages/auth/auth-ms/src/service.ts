import { KVDB } from "back-core";
import {
    UserRepository, UserKey, UserValue,
    UserByEmailRepository, UserByEmailKey,
    AuthMethodRepository, AuthKey, AuthMethodValue,
    UserAuthRepository, UserAuthKey, UserAuthValue,
    OAuthClientRepository, OAuthClientKey, OAuthClientValue,
    AuthCodeRepository, AuthCodeKey, AuthCodeValue,
    RefreshTokenRepository, RefreshTokenKey, RefreshTokenValue,
    RefreshByHashRepository, RefreshByHashKey,
    MagicLinkRepository, MagicLinkKey, MagicLinkValue
} from "./users-store-entities";

class UsersStoreService {
    public readonly userRepo: UserRepository;
    public readonly userByEmailRepo: UserByEmailRepository;
    public readonly authMethodRepo: AuthMethodRepository;
    public readonly userAuthRepo: UserAuthRepository;
    public readonly oauthClientRepo: OAuthClientRepository;
    public readonly authCodeRepo: AuthCodeRepository;
    public readonly refreshTokenRepo: RefreshTokenRepository;
    public readonly refreshByHashRepo: RefreshByHashRepository;
    public readonly magicLinkRepo: MagicLinkRepository;

    constructor(db: KVDB) {
        this.userRepo = new UserRepository(db);
        this.userByEmailRepo = new UserByEmailRepository(db);
        this.authMethodRepo = new AuthMethodRepository(db);
        this.userAuthRepo = new UserAuthRepository(db);
        this.oauthClientRepo = new OAuthClientRepository(db);
        this.authCodeRepo = new AuthCodeRepository(db);
        this.refreshTokenRepo = new RefreshTokenRepository(db);
        this.refreshByHashRepo = new RefreshByHashRepository(db);
        this.magicLinkRepo = new MagicLinkRepository(db);
    }

    // ========== USERS ==========
    
    createUser(user: UserValue): void {
        this.userRepo.save(new UserKey(user.id), user);
        this.userByEmailRepo.save(new UserByEmailKey(user.email), user.id);
    }

    getUser(userId: string): UserValue | null {
        return this.userRepo.get(new UserKey(userId));
    }

    getUserByEmail(email: string): UserValue | null {
        const userId = this.userByEmailRepo.get(new UserByEmailKey(email));
        if (!userId) return null;
        return this.getUser(userId);
    }

    updateUser(userId: string, updates: Partial<UserValue>): void {
        const user = this.getUser(userId);
        if (!user) throw new Error(`User ${userId} not found`);
        
        const updatedUser = { ...user, ...updates };
        this.userRepo.save(new UserKey(userId), updatedUser);
        
        // Если email изменился, обновляем индекс
        if (updates.email && updates.email !== user.email) {
            this.userByEmailRepo.delete(new UserByEmailKey(user.email));
            this.userByEmailRepo.save(new UserByEmailKey(updates.email), userId);
        }
    }

    deleteUser(userId: string): void {
        const user = this.getUser(userId);
        if (!user) return;
        
        this.userRepo.delete(new UserKey(userId));
        this.userByEmailRepo.delete(new UserByEmailKey(user.email));
        
        // Удаляем все auth methods юзера
        const providers = this.listUserAuthProviders(userId);
        providers.forEach(provider => {
            this.unlinkAuthMethod(userId, provider);
        });
    }

    // ========== AUTH METHODS ==========
    
    linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): void {
        const authMethod: AuthMethodValue = {
            user_id: userId,
            email,
            last_used_at: Date.now()
        };
        
        const userAuth: UserAuthValue = {
            provider_user_id: providerUserId,
            email,
            last_used_at: Date.now()
        };
        
        this.authMethodRepo.save(new AuthKey(provider, providerUserId), authMethod);
        this.userAuthRepo.save(new UserAuthKey(userId, provider), userAuth);
    }

    unlinkAuthMethod(userId: string, provider: string): void {
        const userAuth = this.userAuthRepo.get(new UserAuthKey(userId, provider));
        if (!userAuth) return;
        
        this.authMethodRepo.delete(new AuthKey(provider, userAuth.provider_user_id));
        this.userAuthRepo.delete(new UserAuthKey(userId, provider));
    }

    getAuthMethodByProvider(provider: string, providerUserId: string): AuthMethodValue | null {
        return this.authMethodRepo.get(new AuthKey(provider, providerUserId));
    }

    getUserAuthMethods(userId: string): UserAuthValue[] {
        const providers = this.listUserAuthProviders(userId);
        return providers
            .map(provider => this.userAuthRepo.get(new UserAuthKey(userId, provider)))
            .filter((auth): auth is UserAuthValue => auth !== null);
    }

    listUserAuthProviders(userId: string): string[] {
        // Получаем все ключи с префиксом user_auth:{userId}:
        const prefix = `user_auth:${userId}:`;
        const keys = this.userAuthRepo.listKeys();
        return keys
            .filter(key => key.startsWith(prefix))
            .map(key => key.substring(prefix.length));
    }

    updateAuthMethodLastUsed(provider: string, providerUserId: string): void {
        const authMethod = this.getAuthMethodByProvider(provider, providerUserId);
        if (!authMethod) return;
        
        const now = Date.now();
        authMethod.last_used_at = now;
        this.authMethodRepo.save(new AuthKey(provider, providerUserId), authMethod);
        
        // Обновляем и в user_auth
        const userAuth = this.userAuthRepo.get(new UserAuthKey(authMethod.user_id, provider));
        if (userAuth) {
            userAuth.last_used_at = now;
            this.userAuthRepo.save(new UserAuthKey(authMethod.user_id, provider), userAuth);
        }
    }

    // ========== OAUTH CLIENTS ==========
    
    createOAuthClient(client: OAuthClientValue): void {
        this.oauthClientRepo.save(new OAuthClientKey(client.client_id), client);
    }

    getOAuthClient(clientId: string): OAuthClientValue | null {
        return this.oauthClientRepo.get(new OAuthClientKey(clientId));
    }

    updateOAuthClient(clientId: string, updates: Partial<OAuthClientValue>): void {
        const client = this.getOAuthClient(clientId);
        if (!client) throw new Error(`OAuth client ${clientId} not found`);
        
        const updatedClient = { ...client, ...updates };
        this.oauthClientRepo.save(new OAuthClientKey(clientId), updatedClient);
    }

    deleteOAuthClient(clientId: string): void {
        this.oauthClientRepo.delete(new OAuthClientKey(clientId));
    }

    listOAuthClients(): OAuthClientValue[] {
        const keys = this.oauthClientRepo.listKeys();
        return keys
            .map(key => this.oauthClientRepo.get(new OAuthClientKey(key)))
            .filter((client): client is OAuthClientValue => client !== null);
    }

    // ========== AUTHORIZATION CODES ==========
    
    createAuthCode(authCode: AuthCodeValue): void {
        this.authCodeRepo.save(new AuthCodeKey(authCode.code), authCode);
    }

    getAuthCode(code: string): AuthCodeValue | null {
        return this.authCodeRepo.get(new AuthCodeKey(code));
    }

    markAuthCodeAsUsed(code: string): void {
        const authCode = this.getAuthCode(code);
        if (!authCode) return;
        
        authCode.used = true;
        this.authCodeRepo.save(new AuthCodeKey(code), authCode);
    }

    deleteAuthCode(code: string): void {
        this.authCodeRepo.delete(new AuthCodeKey(code));
    }

    // ========== REFRESH TOKENS ==========
    
    createRefreshToken(userId: string, clientId: string, tokenHash: string, scope: string, expiresAt: number): void {
        const token: RefreshTokenValue = {
            scope,
            expires_at: expiresAt,
            revoked: false
        };
        
        this.refreshTokenRepo.save(new RefreshTokenKey(userId, clientId, tokenHash), token);
        this.refreshByHashRepo.save(new RefreshByHashKey(tokenHash), { user_id: userId, client_id: clientId });
    }

    getRefreshToken(tokenHash: string): (RefreshTokenValue & { user_id: string; client_id: string }) | null {
        const lookup = this.refreshByHashRepo.get(new RefreshByHashKey(tokenHash));
        if (!lookup) return null;
        
        const token = this.refreshTokenRepo.get(new RefreshTokenKey(lookup.user_id, lookup.client_id, tokenHash));
        if (!token) return null;
        
        return {
            ...token,
            user_id: lookup.user_id,
            client_id: lookup.client_id
        };
    }

    revokeRefreshToken(tokenHash: string): void {
        const lookup = this.refreshByHashRepo.get(new RefreshByHashKey(tokenHash));
        if (!lookup) return;
        
        const token = this.refreshTokenRepo.get(new RefreshTokenKey(lookup.user_id, lookup.client_id, tokenHash));
        if (!token) return;
        
        token.revoked = true;
        this.refreshTokenRepo.save(new RefreshTokenKey(lookup.user_id, lookup.client_id, tokenHash), token);
    }

    revokeAllUserTokens(userId: string, clientId?: string): void {
        const prefix = clientId 
            ? `refresh:${userId}:${clientId}:` 
            : `refresh:${userId}:`;
        
        const keys = this.refreshTokenRepo.listKeys();
        const tokensToRevoke = keys.filter(key => key.startsWith(prefix));
        
        tokensToRevoke.forEach(key => {
            // Извлекаем tokenHash из ключа
            const parts = key.split(':');
            const tokenHash = parts[parts.length - 1];
            this.revokeRefreshToken(tokenHash);
        });
    }

    deleteRefreshToken(tokenHash: string): void {
        const lookup = this.refreshByHashRepo.get(new RefreshByHashKey(tokenHash));
        if (!lookup) return;
        
        this.refreshTokenRepo.delete(new RefreshTokenKey(lookup.user_id, lookup.client_id, tokenHash));
        this.refreshByHashRepo.delete(new RefreshByHashKey(tokenHash));
    }

    // ========== MAGIC LINK TOKENS ==========
    
    createMagicLink(magicLink: MagicLinkValue): void {
        this.magicLinkRepo.save(new MagicLinkKey(magicLink.token), magicLink);
    }

    getMagicLink(token: string): MagicLinkValue | null {
        return this.magicLinkRepo.get(new MagicLinkKey(token));
    }

    markMagicLinkAsUsed(token: string): void {
        const magicLink = this.getMagicLink(token);
        if (!magicLink) return;
        
        magicLink.used = true;
        this.magicLinkRepo.save(new MagicLinkKey(token), magicLink);
    }

    deleteMagicLink(token: string): void {
        this.magicLinkRepo.delete(new MagicLinkKey(token));
    }

    // ========== CLEANUP UTILITIES ==========
    
    cleanupExpiredAuthCodes(): number {
        const now = Date.now();
        const keys = this.authCodeRepo.listKeys();
        let deleted = 0;
        
        keys.forEach(key => {
            const authCode = this.authCodeRepo.get(new AuthCodeKey(key));
            if (authCode && authCode.expires_at < now) {
                this.deleteAuthCode(key);
                deleted++;
            }
        });
        
        return deleted;
    }

    cleanupExpiredMagicLinks(): number {
        const now = Date.now();
        const keys = this.magicLinkRepo.listKeys();
        let deleted = 0;
        
        keys.forEach(key => {
            const magicLink = this.magicLinkRepo.get(new MagicLinkKey(key));
            if (magicLink && magicLink.expires_at < now) {
                this.deleteMagicLink(key);
                deleted++;
            }
        });
        
        return deleted;
    }

    cleanupExpiredRefreshTokens(): number {
        const now = Date.now();
        const keys = this.refreshTokenRepo.listKeys();
        let deleted = 0;
        
        keys.forEach(key => {
            // Извлекаем составные части ключа
            const parts = key.split(':');
            if (parts.length < 3) return;
            
            const tokenHash = parts[parts.length - 1];
            const token = this.getRefreshToken(tokenHash);
            
            if (token && token.expires_at < now) {
                this.deleteRefreshToken(tokenHash);
                deleted++;
            }
        });
        
        return deleted;
    }
}

export { UsersStoreService };