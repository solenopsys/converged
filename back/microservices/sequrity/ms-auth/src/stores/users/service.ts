import { SqlStore } from "back-core";
import {
  UserRepository,
  AuthMethodRepository,
  OAuthClientRepository,
  UserEntity,
  AuthMethodEntity,
  OAuthClientEntity,
} from "./entities";
import type {
  User,
  UserInput,
  UserUpdate,
  AuthMethod,
  OAuthClient,
  OAuthClientInput,
  OAuthClientUpdate,
} from "../../types";

export class UsersStoreService {
  private readonly userRepo: UserRepository;
  private readonly authRepo: AuthMethodRepository;
  private readonly clientRepo: OAuthClientRepository;

  constructor(private store: SqlStore) {
    this.userRepo = new UserRepository(store, "users", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
    this.authRepo = new AuthMethodRepository(store, "auth_methods", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
    this.clientRepo = new OAuthClientRepository(store, "oauth_clients", {
      primaryKey: "clientId",
      extractKey: (entry) => ({ clientId: entry.clientId }),
      buildWhereCondition: (key) => ({ clientId: key.clientId }),
    });
  }

  async createUser(input: UserInput): Promise<User> {
    const entity: UserEntity = {
      id: input.id,
      email: input.email,
      name: input.name,
      picture: input.picture ?? null,
      emailVerified: input.emailVerified ? 1 : 0,
      createdAt: new Date().toISOString(),
    };
    const created = await this.userRepo.create(entity as any);
    return this.toUser(created);
  }

  async getUser(userId: string): Promise<User | null> {
    const entity = await this.userRepo.findById({ id: userId });
    return entity ? this.toUser(entity) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.store.db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();
    return result ? this.toUser(result as UserEntity) : null;
  }

  async updateUser(userId: string, updates: UserUpdate): Promise<User> {
    const updateEntity: Partial<UserEntity> = {
      email: updates.email,
      name: updates.name,
      picture: updates.picture,
      emailVerified:
        updates.emailVerified === undefined
          ? undefined
          : updates.emailVerified
            ? 1
            : 0,
    };

    const updated = await this.userRepo.update({ id: userId }, updateEntity);
    if (!updated) {
      throw new Error(`User ${userId} not found`);
    }
    return this.toUser(updated);
  }

  async deleteUser(userId: string): Promise<boolean> {
    await this.store.db
      .deleteFrom("auth_methods")
      .where("userId", "=", userId)
      .execute();
    return this.userRepo.delete({ id: userId });
  }

  async linkAuthMethod(
    userId: string,
    provider: string,
    providerUserId: string,
    email: string,
  ): Promise<void> {
    const id = this.buildAuthId(provider, providerUserId);
    const now = new Date().toISOString();
    const entity: AuthMethodEntity = {
      id,
      userId,
      provider,
      providerUserId,
      email,
      lastUsedAt: now,
      createdAt: now,
    };

    const existing = await this.authRepo.findById({ id });
    if (existing) {
      await this.authRepo.update(
        { id },
        {
          userId,
          email,
          lastUsedAt: now,
        },
      );
      return;
    }

    await this.authRepo.create(entity as any);
  }

  async unlinkAuthMethod(userId: string, provider: string): Promise<void> {
    const methods = await this.getUserAuthMethods(userId);
    const match = methods.find((m) => m.provider === provider);
    if (!match) {
      return;
    }
    await this.authRepo.delete({ id: this.buildAuthId(provider, match.providerUserId) });
  }

  async getAuthMethodByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<AuthMethod | null> {
    const id = this.buildAuthId(provider, providerUserId);
    const entity = await this.authRepo.findById({ id });
    return entity ? this.toAuthMethod(entity) : null;
  }

  async getUserAuthMethods(userId: string): Promise<AuthMethod[]> {
    const items = await this.store.db
      .selectFrom("auth_methods")
      .selectAll()
      .where("userId", "=", userId)
      .execute();
    return (items as AuthMethodEntity[]).map((item) =>
      this.toAuthMethod(item),
    );
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

  async updateOAuthClient(
    clientId: string,
    updates: OAuthClientUpdate,
  ): Promise<OAuthClient> {
    const updateEntity: Partial<OAuthClientEntity> = {
      clientSecret: updates.clientSecret,
      redirectUris: updates.redirectUris
        ? JSON.stringify(updates.redirectUris)
        : undefined,
      grantTypes: updates.grantTypes
        ? JSON.stringify(updates.grantTypes)
        : undefined,
      trusted:
        updates.trusted === undefined ? undefined : updates.trusted ? 1 : 0,
    };

    const updated = await this.clientRepo.update({ clientId }, updateEntity);
    if (!updated) {
      throw new Error(`OAuth client ${clientId} not found`);
    }
    return this.toOAuthClient(updated);
  }

  async getOAuthClient(clientId: string): Promise<OAuthClient | null> {
    const entity = await this.clientRepo.findById({ clientId });
    return entity ? this.toOAuthClient(entity) : null;
  }

  async listOAuthClients(): Promise<OAuthClient[]> {
    const items = await this.clientRepo.findAll({ limit: 1000 });
    return items.map((item) => this.toOAuthClient(item));
  }

  async deleteOAuthClient(clientId: string): Promise<boolean> {
    return this.clientRepo.delete({ clientId });
  }

  private toUser(entity: UserEntity): User {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      picture: entity.picture ?? undefined,
      emailVerified: Boolean(entity.emailVerified),
      createdAt: entity.createdAt,
    };
  }

  private toAuthMethod(entity: AuthMethodEntity): AuthMethod {
    return {
      userId: entity.userId,
      provider: entity.provider,
      providerUserId: entity.providerUserId,
      email: entity.email,
      lastUsedAt: entity.lastUsedAt,
    };
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

  private buildAuthId(provider: string, providerUserId: string): string {
    return `${provider}:${providerUserId}`;
  }
}
