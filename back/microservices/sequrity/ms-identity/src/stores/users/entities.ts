import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString } from "../../types";

export interface UserKey extends KeySQL {
  id: string;
}

export interface UserEntity {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  emailVerified: number;
  createdAt: ISODateString;
}

export class UserRepository extends BaseRepositorySQL<UserKey, UserEntity> {}

export interface AuthMethodKey extends KeySQL {
  id: string;
}

export interface AuthMethodEntity {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  lastUsedAt: ISODateString;
  createdAt: ISODateString;
}

export class AuthMethodRepository extends BaseRepositorySQL<AuthMethodKey, AuthMethodEntity> {}
