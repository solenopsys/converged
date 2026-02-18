import type {
  OAuthService,
  OAuthProviderName,
  OAuthProviderTemplate,
  OAuthProviderInput,
  OAuthProviderUpdate,
  OAuthProvider,
  OAuthState,
} from "./types";
import { StoresController } from "./stores";

const PROVIDER_TEMPLATES: OAuthProviderTemplate[] = [
  {
    provider: "google",
    displayName: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  {
    provider: "apple",
    displayName: "Apple",
    authorizeUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    userinfoUrl: "",
    scopes: ["name", "email"],
  },
  {
    provider: "microsoft",
    displayName: "Microsoft",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scopes: ["openid", "email", "profile", "offline_access"],
  },
  {
    provider: "meta",
    displayName: "Meta",
    authorizeUrl: "https://www.facebook.com/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/oauth/access_token",
    userinfoUrl: "https://graph.facebook.com/me",
    scopes: ["email", "public_profile"],
  },
  {
    provider: "github",
    displayName: "GitHub",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userinfoUrl: "https://api.github.com/user",
    scopes: ["user:email", "read:user"],
  },
];

export class OAuthServiceImpl implements OAuthService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      this.stores = new StoresController("oauth-ms");
      await this.stores.init();
    })();
    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  private getProviderFromEnv(provider: OAuthProviderName): OAuthProvider | null {
    const template = PROVIDER_TEMPLATES.find((item) => item.provider === provider);
    if (!template) {
      return null;
    }

    const prefix = provider.toUpperCase();
    const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
    const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }

    const enabledRaw = process.env[`${prefix}_OAUTH_ENABLED`]?.trim().toLowerCase();
    const enabled = enabledRaw ? enabledRaw !== "false" : true;
    const scopesRaw = process.env[`${prefix}_OAUTH_SCOPES`];
    const scopes = scopesRaw
      ? scopesRaw.split(/[,\s]+/).map((value) => value.trim()).filter(Boolean)
      : template.scopes;

    return {
      provider,
      clientId,
      clientSecret,
      authorizeUrl: process.env[`${prefix}_AUTHORIZE_URL`]?.trim() || template.authorizeUrl,
      tokenUrl: process.env[`${prefix}_TOKEN_URL`]?.trim() || template.tokenUrl,
      userinfoUrl: process.env[`${prefix}_USERINFO_URL`]?.trim() || template.userinfoUrl,
      scopes,
      enabled,
      createdAt: Date.now(),
    } as OAuthProvider;
  }

  async listProviderTemplates(): Promise<OAuthProviderTemplate[]> {
    return PROVIDER_TEMPLATES;
  }

  async getProviderTemplate(
    provider: OAuthProviderName,
  ): Promise<OAuthProviderTemplate | null> {
    return PROVIDER_TEMPLATES.find((item) => item.provider === provider) ?? null;
  }

  async createProvider(provider: OAuthProviderInput): Promise<void> {
    await this.ready();
    await this.stores.providers.createProvider(provider);
  }

  async getProvider(provider: OAuthProviderName): Promise<OAuthProvider | null> {
    await this.ready();
    if (provider === "google" || provider === "github") {
      return this.getProviderFromEnv(provider);
    }
    return this.stores.providers.getProvider(provider);
  }

  async updateProvider(
    providerName: OAuthProviderName,
    updates: OAuthProviderUpdate,
  ): Promise<void> {
    await this.ready();
    await this.stores.providers.updateProvider(providerName, updates);
  }

  async deleteProvider(providerName: OAuthProviderName): Promise<void> {
    await this.ready();
    await this.stores.providers.deleteProvider(providerName);
  }

  async listProviders(): Promise<OAuthProvider[]> {
    await this.ready();
    const providers = await this.stores.providers.listProviders();
    const google = this.getProviderFromEnv("google");
    const github = this.getProviderFromEnv("github");
    const injected = [google, github].filter(Boolean) as OAuthProvider[];
    const injectedNames = new Set(injected.map((item) => item.provider));
    const dbFiltered = providers.filter((item) => !injectedNames.has(item.provider));
    return [...injected, ...dbFiltered];
  }

  async listEnabledProviders(): Promise<OAuthProvider[]> {
    await this.ready();
    const providers = await this.listProviders();
    return providers.filter((item) => item.enabled);
  }

  async enableProvider(providerName: OAuthProviderName): Promise<void> {
    await this.ready();
    if (providerName === "google" || providerName === "github") return;
    await this.stores.providers.enableProvider(providerName);
  }

  async disableProvider(providerName: OAuthProviderName): Promise<void> {
    await this.ready();
    if (providerName === "google" || providerName === "github") return;
    await this.stores.providers.disableProvider(providerName);
  }

  async isProviderEnabled(providerName: OAuthProviderName): Promise<boolean> {
    await this.ready();
    if (providerName === "google" || providerName === "github") {
      return this.getProviderFromEnv(providerName)?.enabled ?? false;
    }
    return this.stores.providers.isProviderEnabled(providerName);
  }

  async createState(state: OAuthState): Promise<void> {
    await this.ready();
    this.stores.states.createState(state);
  }

  async getState(stateToken: string): Promise<OAuthState | null> {
    await this.ready();
    return this.stores.states.getState(stateToken);
  }

  async deleteState(stateToken: string): Promise<void> {
    await this.ready();
    this.stores.states.deleteState(stateToken);
  }

  async consumeState(stateToken: string): Promise<OAuthState | null> {
    await this.ready();
    return this.stores.states.consumeState(stateToken);
  }

  async cleanupExpiredStates(): Promise<number> {
    await this.ready();
    return this.stores.states.cleanupExpiredStates();
  }

  async generateState(
    provider: OAuthProviderName,
    returnTo: string,
    ttlSeconds?: number,
  ): Promise<string> {
    await this.ready();
    return this.stores.states.generateState(provider, returnTo, ttlSeconds);
  }
}

export default OAuthServiceImpl;
