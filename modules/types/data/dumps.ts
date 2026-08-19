export type StorageInfo = {
  name: string;
  size: number;
};

export type StorageStats = {
  totalSize: number;
  storageCount: number;
  storages: StorageInfo[];
};

export type DumpFile = {
  name: string;
  fileName: string;
  size?: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
}

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export interface DumpsService {
  listStorages(): Promise<StorageInfo[]>;
  storageStats(): Promise<StorageStats>;
  listDumps(params: PaginationParams): Promise<PaginatedResult<DumpFile>>;
  dump(name?: string): Promise<DumpFile[]>;
  getLink(fileName: string): Promise<string>;
}
