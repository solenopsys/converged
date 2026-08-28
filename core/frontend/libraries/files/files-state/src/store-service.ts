import { type HashString } from "../../../../types/files";

export type CompressionType = 'none' | 'deflate' | 'gzip' | 'brotli';
export type CacheRef = { cacheKey: string; sizeBytes?: number };

export interface StoreService {
  save(dataRef: CacheRef, originalSize?: number, compression?: CompressionType, owner?: string): Promise<HashString>;
  get(hash: HashString): Promise<CacheRef>;
  delete?(hash: HashString): Promise<void>;
}
