export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface StorageInfo {
  name: string;
  size: number;
}

export interface DumpFile {
  name: string;
  fileName: string;
  size?: number;
}
