import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString, PartnerKind } from "../../types";

export interface PartnerKey extends KeySQL {
  id: string;
}

export interface PartnerEntity {
  id: string;
  kind: PartnerKind;
  name: string;
  contact?: string | null;
  tags: string;
  note?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export class PartnerRepository extends BaseRepositorySQL<
  PartnerKey,
  PartnerEntity
> {}
