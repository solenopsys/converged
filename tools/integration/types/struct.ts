export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface StructService {
  saveJson(path: string, data: any): Promise<string>;
  readJson(path: string): Promise<any>;
  readJsonBatch(paths: string[]): Promise<any[]>;
  deleteJson(path: string): Promise<void>;
  listJson(params: PaginationParams): Promise<PaginatedResult<string>>;
}
