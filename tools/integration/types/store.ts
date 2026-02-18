export type HashString = string;

export type CompressionType = "none" | "deflate" | "gzip" | "brotli";

export interface PaginationParams {
  key: string;
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface BlockMetadata {
  hash: HashString;
  size: number;
  originalSize: number;
  compression: CompressionType;
  owner: string;
}

export interface StoreService {
  save(
    data: Uint8Array,
    originalSize?: number,
    compression?: CompressionType,
    owner?: string,
  ): Promise<HashString>;
  saveWithHash(
    hash: HashString,
    data: Uint8Array,
    originalSize?: number,
    compression?: CompressionType,
    owner?: string,
  ): Promise<HashString>;
  delete(hash: HashString): Promise<void>;
  get(hash: HashString): Promise<Uint8Array>;
  getWithMeta(hash: HashString): Promise<{
    data: Uint8Array;
    compression: CompressionType;
    originalSize: number;
  }>;
  exists(hash: HashString): Promise<boolean>;
  list(params: PaginationParams): Promise<PaginatedResult<HashString>>;
  storeStatistic(): Promise<any>;
}
