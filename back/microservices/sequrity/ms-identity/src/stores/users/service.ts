import { SqlStore } from "back-core";
import {
  UserRepository,
  AuthMethodRepository,
  UserEntity,
  AuthMethodEntity,
} from "./entities";
import type { User, UserInput, UserUpdate, AuthMethod } from "../../types";

export class UsersStoreService {
  private readonly userRepo: UserRepository;
  private readonly authRepo: AuthMethodRepository;

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
  }

  async createUser(input: UserInput): Promise<User> {
    const entity: UserEntity = {
      id: input.id,
      email: input.email,
      name: input.name,
      picture: input.picture ?? null,
      emailVerified: input.emailVerified ? 1 : 0,
      preset: input.preset ?? "user",
      createdAt: new Date().toISOString(),
    };
    const created = await this.userRepo.create(entity as any);
    return this.toUser(created);
  }

  async listUsers(): Promise<User[]> {
    const items = await this.userRepo.findAll({ limit: 10000 });
    return items.map((item) => this.toUser(item));
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
      preset: updates.preset,
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
      await this.authRepo.update({ id }, { userId, email, lastUsedAt: now });
      return;
    }
    await this.authRepo.create(entity as any);
  }

  async unlinkAuthMethod(userId: string, provider: string): Promise<void> {
    const methods = await this.getUserAuthMethods(userId);
    const match = methods.find((m) => m.provider === provider);
    if (!match) return;
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
    return (items as AuthMethodEntity[]).map((item) => this.toAuthMethod(item));
  }

  private toUser(entity: UserEntity): User {
    return {
      id: entity.id,
      email: entity.email,
      name: entity.name,
      picture: entity.picture ?? undefined,
      emailVerified: Boolean(entity.emailVerified),
      preset: entity.preset,
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

  private buildAuthId(provider: string, providerUserId: string): string {
    return `${provider}:${providerUserId}`;
  }
}
