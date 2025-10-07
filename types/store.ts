export type HashString = string;

export interface PaginationParams {
  key: string;
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;  
}

export interface StoreService {
  save(data:Uint8Array):Promise<HashString>
  delete(hash:HashString):Promise<void>
  get(hash:HashString):Promise<Uint8Array>
  list(params:PaginationParams):Promise<PaginatedResult<HashString>>
  storeStatistic():Promise<any>
}