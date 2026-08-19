import { SqlStore } from "back-core";
import {
  OAuthProviderRepository,
  OAuthProviderEntity,
} from "./entities";
import type {
  OAuthProvider,
  OAuthProviderInput,
  OAuthProviderUpdate,
} from "../../types";

export class OAuthProvidersStoreService {
  private readonly providerRepo: OAuthProviderRepository;

  constructor(private store: SqlStore) {
    this.providerRepo = new OAuthProviderRepository(store, "oauth_providers", {
      primaryKey: "provider",
      extractKey: (entry) => ({ provider: entry.provider }),
      buildWhereCondition: (key) => ({ provider: key.provider }),
    });
  }

  async createProvider(provider: OAuthProviderInput): Promise<void> {
    const entity: OAuthProviderEntity = {
      provider: provider.provider,
      clientId: provider.clientId,
      clientSecret: provider.clientSecret,
      authorizeUrl: provider.authorizeUrl,
      tokenUrl: provider.tokenUrl,
      userinfoUrl: provider.userinfoUrl,
      scopes: JSON.stringify(provider.scopes ?? []),
      enabled: provider.enabled ? 1 : 0,
      createdAt: Date.now(),
    };
    await this.providerRepo.create(entity as any);
  }

  async getProvider(providerName: string): Promise<OAuthProvider | null> {
    const entity = await this.providerRepo.findById({ provider: providerName });
    return entity ? this.toProvider(entity) : null;
  }

  async updateProvider(
    providerName: string,
    updates: OAuthProviderUpdate,
  ): Promise<void> {
    await this.providerRepo.update(
      { provider: providerName },
      {
        clientId: updates.clientId,
        clientSecret: updates.clientSecret,
        authorizeUrl: updates.authorizeUrl,
        tokenUrl: updates.tokenUrl,
        userinfoUrl: updates.userinfoUrl,
        scopes: updates.scopes ? JSON.stringify(updates.scopes) : undefined,
        enabled:
          updates.enabled === undefined ? undefined : updates.enabled ? 1 : 0,
      },
    );
  }

  async deleteProvider(providerName: string): Promise<void> {
    await this.providerRepo.delete({ provider: providerName });
  }

  async listProviders(): Promise<OAuthProvider[]> {
    const items = await this.providerRepo.findAll({ limit: 1000 });
    return items.map((item) => this.toProvider(item));
  }

  async listEnabledProviders(): Promise<OAuthProvider[]> {
    const items = await this.store.db
      .selectFrom("oauth_providers")
      .selectAll()
      .where("enabled", "=", 1)
      .execute();
    return (items as OAuthProviderEntity[]).map((item) => this.toProvider(item));
  }

  async enableProvider(providerName: string): Promise<void> {
    await this.updateProvider(providerName, { enabled: true });
  }

  async disableProvider(providerName: string): Promise<void> {
    await this.updateProvider(providerName, { enabled: false });
  }

  async isProviderEnabled(providerName: string): Promise<boolean> {
    const provider = await this.getProvider(providerName);
    return provider?.enabled ?? false;
  }

  private toProvider(entity: OAuthProviderEntity): OAuthProvider {
    return {
      provider: entity.provider,
      clientId: entity.clientId,
      clientSecret: entity.clientSecret,
      authorizeUrl: entity.authorizeUrl,
      tokenUrl: entity.tokenUrl,
      userinfoUrl: entity.userinfoUrl,
      scopes: this.parseScopes(entity.scopes),
      enabled: Boolean(entity.enabled),
      createdAt: entity.createdAt,
    } as OAuthProvider;
  }

  private parseScopes(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
