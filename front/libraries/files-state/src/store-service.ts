import { type HashString } from "../../../../types/files";

export type CompressionType = 'none' | 'deflate' | 'gzip' | 'brotli';

export interface StoreService {
  save(data: Uint8Array, originalSize?: number, compression?: CompressionType): Promise<HashString>;
  get(hash: HashString): Promise<Uint8Array>;
  delete?(hash: HashString): Promise<void>;
}
