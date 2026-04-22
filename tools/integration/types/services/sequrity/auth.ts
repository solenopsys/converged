export type ISODateString = string;

export type OAuthClient = {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grantTypes: string[];
  trusted: boolean;
  createdAt: ISODateString;
}

export type OAuthClientInput = {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grantTypes: string[];
  trusted: boolean;
}

export type OAuthClientUpdate = {
  clientSecret?: string;
  redirectUris?: string[];
  grantTypes?: string[];
  trusted?: boolean;
}

export type GetMagicLinkResult = {
  ok: boolean;
  token: string;
  expiresAt: number;
}

export type VerifyLinkResult = {
  token: string;
  userId: string;
  email: string;
  returnTo?: string;
}

export type LoginResult = {
  token: string;
  userId: string;
  email: string;
}

export type TemporaryUserResult = {
  token: string;
  userId: string;
  email: string;
  temporary: true;
}

export type CleanupResult = {
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
  /** @public */
  createTemporaryUser(sessionId?: string): Promise<TemporaryUserResult>;
  logout(userId: string, clientId?: string): Promise<void>;

  createOAuthClient(client: OAuthClientInput): Promise<OAuthClient>;
  getOAuthClient(clientId: string): Promise<OAuthClient | null>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient>;
  listOAuthClients(): Promise<OAuthClient[]>;
  deleteOAuthClient(clientId: string): Promise<boolean>;

  cleanupExpired(): Promise<CleanupResult>;
}
