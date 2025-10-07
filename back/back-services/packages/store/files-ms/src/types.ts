
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

export interface FilesService {
  save(file:FileMetadata):Promise<UUID>
  saveChunk(chunk:FileChunk):Promise<HashString>
  update(id:UUID, file:FileMetadata):Promise<void>
  delete(id:UUID):Promise<void>
  get(id:UUID):Promise<FileMetadata>
  getChunks(id:UUID):Promise<FileChunk[]>
  list(params:PaginationParams):Promise<PaginatedResult<FileMetadata>>
  statistic():Promise<any>
}
