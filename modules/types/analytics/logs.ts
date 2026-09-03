export type LogEvent = {
  ts: number;
  source: string;
  level: number;
  code: number;
  message: string;
};

export type LogEventInput = {
  ts?: number;
  source: string;
  level: number;
  code: number;
  message: string;
};

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = {
  id: string;
  label: string;
  valueType: "string" | "number" | "boolean" | "date" | "enum";
  operators: string[];
};

export type SelectionDescriptor = {
  objectType: string;
  title: string;
  fields: SelectionFieldDescriptor[];
  filterExample?: FilterObject;
  revision?: string;
};

export type SelectionStats = { totalCount: number };

export type LogQueryParams = {
  offset: number;
  limit: number;
  source?: string;
  level?: number;
  code?: number;
  from_ts?: number;
  to_ts?: number;
  filter?: FilterObject;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export type LogsStatistic = {
  totalHot: number;
  totalCold: number;
  byLevel: Record<number, number>;
  bySource: Record<string, number>;
  errors: number;
  warnings: number;
};

export type LogsStatisticKey = "title";

export interface LogsService {
  write(event: LogEventInput): Promise<void>;
  listHot(params: LogQueryParams): Promise<PaginatedResult<LogEvent>>;
  listCold(params: LogQueryParams): Promise<PaginatedResult<LogEvent>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectLogs(filter?: FilterObject): Promise<SelectionStats>;
	getStatistic(keys?: LogsStatisticKey[]): Promise<LogsStatistic>;
  archiveHotToCold(): Promise<number>;
}
