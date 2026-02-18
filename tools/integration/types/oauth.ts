export type OAuthProviderName =
  | "google"
  | "apple"
  | "microsoft"
  | "meta"
  | "github";

export interface OAuthProviderTemplate {
  provider: OAuthProviderName;
  displayName: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
}

export interface OAuthProvider {
  provider: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  enabled: boolean;
  createdAt: number;
}

export interface OAuthProviderInput {
  provider: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  enabled?: boolean;
}

export interface OAuthProviderUpdate {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  scopes?: string[];
  enabled?: boolean;
}

export interface OAuthState {
  state: string;
  returnTo: string;
  provider: OAuthProviderName;
  expiresAt: number;
}

export interface OAuthService {
  listProviderTemplates(): Promise<OAuthProviderTemplate[]>;
  getProviderTemplate(provider: OAuthProviderName): Promise<OAuthProviderTemplate | null>;

  createProvider(provider: OAuthProviderInput): Promise<void>;
  getProvider(provider: OAuthProviderName): Promise<OAuthProvider | null>;
  updateProvider(
    providerName: OAuthProviderName,
    updates: OAuthProviderUpdate,
  ): Promise<void>;
  deleteProvider(providerName: OAuthProviderName): Promise<void>;
  listProviders(): Promise<OAuthProvider[]>;
  listEnabledProviders(): Promise<OAuthProvider[]>;
  enableProvider(providerName: OAuthProviderName): Promise<void>;
  disableProvider(providerName: OAuthProviderName): Promise<void>;
  isProviderEnabled(providerName: OAuthProviderName): Promise<boolean>;

  createState(state: OAuthState): Promise<void>;
  getState(stateToken: string): Promise<OAuthState | null>;
  deleteState(stateToken: string): Promise<void>;
  consumeState(stateToken: string): Promise<OAuthState | null>;
  cleanupExpiredStates(): Promise<number>;
  generateState(
    provider: OAuthProviderName,
    returnTo: string,
    ttlSeconds?: number,
  ): Promise<string>;
}
