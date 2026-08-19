import { SqlStore } from "back-core";
import { OAuthClientRepository, OAuthClientEntity } from "./entities";
import type { OAuthClient, OAuthClientInput, OAuthClientUpdate } from "../../types";

export class ClientsStoreService {
  private readonly clientRepo: OAuthClientRepository;

  constructor(private store: SqlStore) {
    this.clientRepo = new OAuthClientRepository(store, "oauth_clients", {
      primaryKey: "clientId",
      extractKey: (entry) => ({ clientId: entry.clientId }),
      buildWhereCondition: (key) => ({ clientId: key.clientId }),
    });
  }

  async createOAuthClient(input: OAuthClientInput): Promise<OAuthClient> {
    const entity: OAuthClientEntity = {
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      redirectUris: JSON.stringify(input.redirectUris ?? []),
      grantTypes: JSON.stringify(input.grantTypes ?? []),
      trusted: input.trusted ? 1 : 0,
      createdAt: new Date().toISOString(),
    };
    const created = await this.clientRepo.create(entity as any);
    return this.toOAuthClient(created);
  }

  async getOAuthClient(clientId: string): Promise<OAuthClient | null> {
    const entity = await this.clientRepo.findById({ clientId });
    return entity ? this.toOAuthClient(entity) : null;
  }

  async updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient> {
    const updateEntity: Partial<OAuthClientEntity> = {
      clientSecret: updates.clientSecret,
      redirectUris: updates.redirectUris ? JSON.stringify(updates.redirectUris) : undefined,
      grantTypes: updates.grantTypes ? JSON.stringify(updates.grantTypes) : undefined,
      trusted: updates.trusted === undefined ? undefined : updates.trusted ? 1 : 0,
    };
    const updated = await this.clientRepo.update({ clientId }, updateEntity);
    if (!updated) {
      throw new Error(`OAuth client ${clientId} not found`);
    }
    return this.toOAuthClient(updated);
  }

  async listOAuthClients(): Promise<OAuthClient[]> {
    const items = await this.clientRepo.findAll({ limit: 1000 });
    return items.map((item) => this.toOAuthClient(item));
  }

  async deleteOAuthClient(clientId: string): Promise<boolean> {
    return this.clientRepo.delete({ clientId });
  }

  private toOAuthClient(entity: OAuthClientEntity): OAuthClient {
    return {
      clientId: entity.clientId,
      clientSecret: entity.clientSecret,
      redirectUris: this.parseJsonArray(entity.redirectUris),
      grantTypes: this.parseJsonArray(entity.grantTypes),
      trusted: Boolean(entity.trusted),
      createdAt: entity.createdAt,
    };
  }

  private parseJsonArray(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
