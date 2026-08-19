import { BaseRepositorySQL, KeySQL } from "back-core";

export type HashString = string;

export interface ChunkMetadataKey extends KeySQL {
  hash: HashString;
}

export type CompressionType = "none" | "deflate" | "gzip" | "brotli";

export interface ChunkMetadataEntity {
  hash: HashString;
  size: number;
  originalSize: number;
  compression: CompressionType;
  refCount: number;
  owner: string;
  createdAt: string;
}

export class ChunkMetadataRepository extends BaseRepositorySQL<
  ChunkMetadataKey,
  ChunkMetadataEntity
> {}
