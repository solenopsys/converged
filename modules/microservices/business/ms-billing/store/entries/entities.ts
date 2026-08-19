import { BaseRepositorySQL, KeySQL } from "back-core";
import type { BillingCategory, ISODateString } from "../../types";

export interface BillingEntryKey extends KeySQL {
  id: string;
}

export interface BillingEntryEntity {
  id: string;
  owner: string;
  category: BillingCategory;
  amount: number;
  currency: string;
  description: string;
  createdAt: ISODateString;
}

export class BillingEntryRepository extends BaseRepositorySQL<
  BillingEntryKey,
  BillingEntryEntity
> {}
