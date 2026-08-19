export type StaticStatus = "todo" | "loaded" | "outdated";

export type StaticContentType = "html" | "svg";

export type StaticMeta = {
  id: string;
  status: StaticStatus;
  contentType: StaticContentType;
  size: number;
  loadedAt: number | null;
  updatedAt: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type StaticFilters = {
  status?: StaticStatus;
  contentType?: StaticContentType;
  search?: string;
};
