export type StorageInfo = {
  name: string;
  size: number;
};

export type DumpFile = {
  name: string;
  fileName: string;
  size?: number;
};

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface DumpsService {
  listStorages(): Promise<StorageInfo[]>;
  listDumps(params: PaginationParams): Promise<PaginatedResult<DumpFile>>;
  dump(name?: string): Promise<DumpFile[]>;
  getLink(fileName: string): Promise<string>;
}
