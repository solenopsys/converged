export type TelemetryEvent = {
  ts: number;
  device_id: string;
  param: string;
  value: number;
  unit: string;
};

export type TelemetryEventInput = {
  ts?: number;
  device_id: string;
  param: string;
  value: number;
  unit?: string;
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

export type TelemetryQueryParams = {
  offset: number;
  limit: number;
  device_id?: string;
  param?: string;
  from_ts?: number;
  to_ts?: number;
  filter?: FilterObject;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export type TelemetryStatistic = {
  totalHot: number;
  totalCold: number;
  byDevice: Record<string, number>;
  byParam: Record<string, number>;
};

export interface TelemetryService {
  write(event: TelemetryEventInput): Promise<void>;
  listHot(params: TelemetryQueryParams): Promise<PaginatedResult<TelemetryEvent>>;
  listCold(params: TelemetryQueryParams): Promise<PaginatedResult<TelemetryEvent>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectTelemetry(filter?: FilterObject): Promise<SelectionStats>;
  getStatistic(): Promise<TelemetryStatistic>;
  archiveHotToCold(): Promise<number>;
}
