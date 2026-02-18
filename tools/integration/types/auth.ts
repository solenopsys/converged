export type ISODateString = string;

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  createdAt: ISODateString;
}

export interface UserInput {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
}

export interface UserUpdate {
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
}

export interface AuthMethod {
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  lastUsedAt: ISODateString;
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grantTypes: string[];
  trusted: boolean;
  createdAt: ISODateString;
}

export interface OAuthClientInput {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grantTypes: string[];
  trusted: boolean;
}

export interface OAuthClientUpdate {
  clientSecret?: string;
  redirectUris?: string[];
  grantTypes?: string[];
  trusted?: boolean;
}

export interface AuthCode {
  code: string;
  clientId: string;
  userId: string;
  codeChallenge?: string;
  expiresAt: number;
  used: boolean;
}

export interface AuthCodeInput {
  code: string;
  clientId: string;
  userId: string;
  codeChallenge?: string;
  expiresAt: number;
  used?: boolean;
}

export interface RefreshToken {
  tokenHash: string;
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: number;
  revoked: boolean;
}

export interface MagicLink {
  token: string;
  email: string;
  returnTo?: string;
  expiresAt: number;
  used: boolean;
}

export interface MagicLinkInput {
  token: string;
  email: string;
  returnTo?: string;
  expiresAt: number;
  used?: boolean;
}

export interface CleanupResult {
  authCodes: number;
  magicLinks: number;
  refreshTokens: number;
}

export interface AuthService {
  createUser(user: UserInput): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(userId: string, updates: UserUpdate): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;

  linkAuthMethod(
    userId: string,
    provider: string,
    providerUserId: string,
    email: string,
  ): Promise<void>;
  unlinkAuthMethod(userId: string, provider: string): Promise<void>;
  getAuthMethodByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<AuthMethod | null>;
  getUserAuthMethods(userId: string): Promise<AuthMethod[]>;

  createOAuthClient(client: OAuthClientInput): Promise<OAuthClient>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient>;
  getOAuthClient(clientId: string): Promise<OAuthClient | null>;
  listOAuthClients(): Promise<OAuthClient[]>;
  deleteOAuthClient(clientId: string): Promise<boolean>;

  createAuthCode(authCode: AuthCodeInput): Promise<void>;
  getAuthCode(code: string): Promise<AuthCode | null>;
  markAuthCodeAsUsed(code: string): Promise<void>;
  deleteAuthCode(code: string): Promise<void>;

  createRefreshToken(
    userId: string,
    clientId: string,
    tokenHash: string,
    scope: string,
    expiresAt: number,
  ): Promise<void>;
  getRefreshToken(tokenHash: string): Promise<RefreshToken | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserTokens(userId: string, clientId?: string): Promise<number>;

  createMagicLink(magicLink: MagicLinkInput): Promise<void>;
  getMagicLink(token: string): Promise<MagicLink | null>;
  markMagicLinkAsUsed(token: string): Promise<void>;

  cleanupExpired(): Promise<CleanupResult>;
}
