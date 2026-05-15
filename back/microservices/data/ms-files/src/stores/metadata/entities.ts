import { BaseRepositorySQL, KeySQL } from "back-core";
import { UUID, HashString, FileStatus, ISODateString } from "../../types";

export interface FileCollectionKey extends KeySQL {
  id: UUID;
}

export interface FileCollectionEntity {
  id: UUID;
  name: string;
  description?: string;
  owner: string;
  createdAt: ISODateString;
}

export class FileCollectionRepository extends BaseRepositorySQL<
  FileCollectionKey,
  FileCollectionEntity
> {}

export interface FileMetadataKey extends KeySQL {
  id: UUID;
}

export interface FileMetadataEntity {
  id: UUID;
  hash: HashString;
  status: FileStatus;
  name: string;
  fileSize: number;
  fileType: string;
  compression: string;
  owner: string;
  createdAt: ISODateString;
  chunksCount: number;
  collectionId?: UUID;
}

export class FileMetadataRepository extends BaseRepositorySQL<
  FileMetadataKey,
  FileMetadataEntity
> {}

export interface FileChunkKey extends KeySQL {
  fileId: UUID;
  chunkNumber: number;
}

export interface FileChunkEntity {
  fileId: UUID;
  hash: HashString;
  chunkNumber: number;
  chunkSize: number;
  createdAt: ISODateString;
}

export class FileChunkRepository extends BaseRepositorySQL<
  FileChunkKey,
  FileChunkEntity
> {}
