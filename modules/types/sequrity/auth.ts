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

export type MagicLinkIdentity = {
  email: string;
  returnTo?: string;
}

export type RefreshSessionResult = {
  userId: string;
  clientId: string;
  refreshToken: string;
}

export type CleanupResult = {
  authCodes: number;
  magicLinks: number;
  refreshTokens: number;
}

// Auth owns only magic-link and refresh-token state. The UI auth-gateway
// orchestrates identity, permissions and JWT issuance with direct calls.
export interface AuthService {
  getMagicLink(email: string, returnTo?: string): Promise<GetMagicLinkResult>;

  consumeMagicLink(token: string): Promise<MagicLinkIdentity>;

  createRefreshSession(userId: string, clientId?: string): Promise<RefreshSessionResult>;

  refreshSession(refreshToken: string): Promise<RefreshSessionResult>;

  logout(userId: string, clientId?: string): Promise<void>;

  createOAuthClient(client: OAuthClientInput): Promise<OAuthClient>;
  getOAuthClient(clientId: string): Promise<OAuthClient | null>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient>;
  listOAuthClients(): Promise<OAuthClient[]>;
  deleteOAuthClient(clientId: string): Promise<boolean>;

  cleanupExpired(): Promise<CleanupResult>;
}
