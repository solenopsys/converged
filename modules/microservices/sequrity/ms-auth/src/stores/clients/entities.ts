import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString } from "../../types";

export interface OAuthClientKey extends KeySQL {
  clientId: string;
}

export interface OAuthClientEntity {
  clientId: string;
  clientSecret: string;
  redirectUris: string;
  grantTypes: string;
  trusted: number;
  createdAt: ISODateString;
}

export class OAuthClientRepository extends BaseRepositorySQL<OAuthClientKey, OAuthClientEntity> {}
