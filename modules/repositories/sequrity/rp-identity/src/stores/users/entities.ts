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
  preset: string;
  lang?: string | null;
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

export interface InviteKey extends KeySQL {
  id: string;
}

/** `tags` is a JSON array in one column: it is read and written whole, never
 *  searched by, so a second table would buy nothing. */
export interface InviteEntity {
  id: string;
  email: string;
  name?: string | null;
  preset: string;
  tags: string;
  invitedBy: string;
  status: string;
  expiresAt: ISODateString;
  sentAt?: ISODateString | null;
  acceptedAt?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export class InviteRepository extends BaseRepositorySQL<
  InviteKey,
  InviteEntity
> {}
