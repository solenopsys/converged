export type RequestId = string;
export type ISODateString = string;
export type RequestStatus = string;

export type RequestFields = Record<string, string | number | boolean | null>;
export type RequestFiles = Record<string, string>;

export type Request = {
  id: RequestId;
  source?: string;
  status: RequestStatus;
  fields: RequestFields;
  files: RequestFiles;
  createdAt: ISODateString;
};

export type RequestInput = {
  source?: string;
  status?: RequestStatus;
  fields: RequestFields;
  files?: RequestFiles;
};

export type RequestListParams = {
  offset: number;
  limit: number;
  source?: string;
};

export type RequestProcessingEntry = {
  id: string;
  requestId: RequestId;
  status: RequestStatus;
  actor: string;
  comment: string;
  createdAt: ISODateString;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface RequestsService {
  createRequest(input: RequestInput): Promise<RequestId>;
  getRequest(id: RequestId): Promise<Request | undefined>;
  listRequests(params: RequestListParams): Promise<PaginatedResult<Request>>;
  updateStatus(
    id: RequestId,
    status: RequestStatus,
    actor: string,
    comment?: string,
  ): Promise<void>;
  listProcessing(requestId: RequestId): Promise<RequestProcessingEntry[]>;
}
