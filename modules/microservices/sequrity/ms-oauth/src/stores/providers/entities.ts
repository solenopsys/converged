import { BaseRepositorySQL, KeySQL } from "back-core";

export interface OAuthProviderKey extends KeySQL {
  provider: string;
}

export interface OAuthProviderEntity {
  provider: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string;
  enabled: number;
  createdAt: number;
}

export class OAuthProviderRepository extends BaseRepositorySQL<
  OAuthProviderKey,
  OAuthProviderEntity
> {}
