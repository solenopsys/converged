export type HashString = string;
export type UUID = string;
export type ISODateString = string; // ISO-8601 UTC


export type PaginationParams = {
    key: string;
    offset: number;
    limit: number;
}

export type PaginatedResult<T> = {
    items: T[];
    totalCount?: number;
}

export type FileStatus = 'uploading' | 'uploaded' | 'failed';

export type FileCollection = {
    id: UUID;
    name: string;
    description?: string;
    owner: string;
    createdAt: ISODateString;
}

export type FileMetadata={
    id:UUID
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

export type FileChunk={
    fileId:UUID
    hash: HashString;
    chunkNumber: number;
    chunkSize: number;
    createdAt: ISODateString; 
}

export type FileStatistic={
    totalFiles: number;
    totalChunks: number;
    totalSize: number;
    createdAt: ISODateString;
}

/** Reference to a binary blob staged in the Valkey cache (see services/data/store.ts). */
export type CacheRef = {
    cacheKey: string;
    sizeBytes?: number;
}

export type MaterializedFile = {
    ref: CacheRef;
    metadata: FileMetadata;
}

export type DetectTypeInput = {
    ref: CacheRef;
    name: string;
}

export type FileTypeDetection = {
    type: string;
    mime: string;
}

export type UnzipInput = {
    ref: CacheRef;
    collectionId: UUID;
    owner: string;
    processId?: string;
}

export type UnzipEntry = {
    fileId: UUID;
    name: string;
}

export type UnzipResult = {
    entries: UnzipEntry[];
}

export type PersistInput = {
    ref: CacheRef;
    name: string;
    fileType: string;
    owner: string;
    collectionId?: UUID;
    processId?: string;
}

export interface FilesService {
  save(file:FileMetadata, processId?:string):Promise<UUID>
  saveChunk(chunk:FileChunk):Promise<HashString>
  update(id:UUID, file:FileMetadata):Promise<void>
  delete(id:UUID):Promise<void>
  get(id:UUID):Promise<FileMetadata>
  getChunks(id:UUID):Promise<FileChunk[]>
  list(params:PaginationParams):Promise<PaginatedResult<FileMetadata>>
  statistic():Promise<any>
  saveCollection(collection:FileCollection):Promise<UUID>
  getCollection(id:UUID):Promise<FileCollection>
  deleteCollection(id:UUID):Promise<void>
  listByCollection(collectionId:UUID):Promise<FileMetadata[]>
  materialize(fileId:UUID):Promise<MaterializedFile>
  detectType(input:DetectTypeInput):Promise<FileTypeDetection>
  unzip(input:UnzipInput):Promise<UnzipResult>
  persist(input:PersistInput):Promise<FileMetadata>
}