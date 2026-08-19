export type StaticStatus = "todo" | "loaded" | "outdated";

export type StaticContentType = "html" | "svg";

export type StaticMeta = {
  id: string;
  status: StaticStatus;
  contentType: StaticContentType;
  size: number;
  loadedAt: number | null;
  updatedAt: number;
}

export type SetMetaParams = {
  id: string;
  contentType: StaticContentType;
  status?: StaticStatus;
}

export type SetDataParams = {
  id: string;
  content: string;
  contentType: StaticContentType;
}

export type ListMetaParams = {
  offset: number;
  limit: number;
  status?: StaticStatus;
  contentType?: StaticContentType;
  search?: string;
}

export type StaticMetaListResult = {
  items: StaticMeta[];
  totalCount?: number;
}

export type FlushResult = {
  removed: number;
}

export type SetStatusPatternParams = {
  pattern: string;
  status: StaticStatus;
}

export type SetStatusPatternResult = {
  updated: number;
}

export interface StaticService {
  getData(id: string): Promise<string | null>;
  setData(params: SetDataParams): Promise<StaticMeta>;

  setMeta(params: SetMetaParams): Promise<StaticMeta>;
  getMeta(id: string): Promise<StaticMeta | null>;
  listMeta(params: ListMetaParams): Promise<StaticMetaListResult>;
  getOneByStatus(status: StaticStatus): Promise<StaticMeta | null>;
  setStatus(id: string, status: StaticStatus): Promise<StaticMeta>;
  setStatusPattern(params: SetStatusPatternParams): Promise<SetStatusPatternResult>;
  deleteMeta(id: string): Promise<void>;

  deleteEntry(id: string): Promise<void>;
  flush(): Promise<FlushResult>;
}
