export type ISODateString = string;

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

export interface GetMagicLinkResult {
  ok: boolean;
  token: string;
  expiresAt: number;
}

export interface VerifyLinkResult {
  userId: string;
  email: string;
  returnTo?: string;
}

export interface LoginResult {
  token: string;
  userId: string;
  email: string;
}

export interface CleanupResult {
  authCodes: number;
  magicLinks: number;
  refreshTokens: number;
}

export interface AuthService {
  /** @public */
  getMagicLink(email: string, returnTo?: string): Promise<GetMagicLinkResult>;
  /** @public */
  verifyLink(token: string): Promise<VerifyLinkResult>;
  /** @public */
  login(email: string, password: string): Promise<LoginResult>;
  logout(userId: string, clientId?: string): Promise<void>;

  createOAuthClient(client: OAuthClientInput): Promise<OAuthClient>;
  getOAuthClient(clientId: string): Promise<OAuthClient | null>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient>;
  listOAuthClients(): Promise<OAuthClient[]>;
  deleteOAuthClient(clientId: string): Promise<boolean>;

  cleanupExpired(): Promise<CleanupResult>;
}
