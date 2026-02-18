export type BillingEntryId = string;
export type ISODateString = string;

export type BillingCategory = "tokens" | "resources" | "module";

export type BillingEntry = {
  id: BillingEntryId;
  owner: string;
  category: BillingCategory;
  amount: number;
  currency: string;
  description?: string;
  createdAt: ISODateString;
};

export type BillingEntryInput = {
  owner: string;
  category: BillingCategory;
  amount: number;
  currency?: string;
  description?: string;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface BillingListParams {
  offset: number;
  limit: number;
  owner?: string;
  category?: BillingCategory;
  from?: ISODateString;
  to?: ISODateString;
}

export interface BillingTotalParams {
  owner?: string;
  category?: BillingCategory;
  from?: ISODateString;
  to?: ISODateString;
}

export interface BillingService {
  addEntry(entry: BillingEntryInput): Promise<BillingEntryId>;
  getEntry(id: BillingEntryId): Promise<BillingEntry | undefined>;
  listEntries(params: BillingListParams): Promise<PaginatedResult<BillingEntry>>;
  total(params: BillingTotalParams): Promise<number>;
}
