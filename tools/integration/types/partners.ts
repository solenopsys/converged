export type PartnerId = string;
export type ISODateString = string;

export type PartnerKind = "client" | "supplier" | "both";

export type Partner = {
  id: PartnerId;
  kind: PartnerKind;
  name: string;
  contact?: string;
  tags?: string[];
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PartnerInput = {
  kind: PartnerKind;
  name: string;
  contact?: string;
  tags?: string[];
  note?: string;
};

export type PartnerUpdate = Partial<PartnerInput>;

export type PartnerListParams = {
  offset: number;
  limit: number;
  kind?: PartnerKind;
  query?: string;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface PartnersService {
  createPartner(input: PartnerInput): Promise<PartnerId>;
  getPartner(id: PartnerId): Promise<Partner | undefined>;
  updatePartner(id: PartnerId, patch: PartnerUpdate): Promise<void>;
  deletePartner(id: PartnerId): Promise<boolean>;
  listPartners(params: PartnerListParams): Promise<PaginatedResult<Partner>>;
}
