export type MdFile = {
  path: string;
  content: string;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface MarkdownService {
  saveMd(mdFile: MdFile): Promise<string>;
  readMd(path: string): Promise<MdFile>;
  readMdJson(path: string): Promise<MdFile>;
  readMdJsonBatch(paths: string[]): Promise<MdFile[]>;
  listOfMd(params: PaginationParams): Promise<PaginatedResult<MdFile>>;
}
