export type CallId = string;
export type CallRecordId = string;

export type CallDialogueItem = {
  text: string;
  timestamp: number;
  who: string;
};

export type Call = {
  id: CallId;
  startedAt: number;
  phone: string;
  threadId?: string;
  recordId: CallRecordId;
};

export type CallRecordingInput = {
  startedAt?: number;
  phone: string;
  data: Uint8Array;
};

export type CallRecordingResult = {
  callId: CallId;
  recordId: CallRecordId;
};

export type CallDialogueInput = {
  callId: CallId;
  threadId?: string;
  dialogue: CallDialogueItem[];
};

export type CallsListParams = {
  offset: number;
  limit: number;
  phone?: string;
  fromTime?: number;
  toTime?: number;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface CallsService {
  saveRecording(input: CallRecordingInput): Promise<CallRecordingResult>;
  saveDialogue(input: CallDialogueInput): Promise<void>;
  getCall(id: CallId): Promise<Call | undefined>;
  listCalls(params: CallsListParams): Promise<PaginatedResult<Call>>;
  getRecording(recordId: CallRecordId): Promise<Uint8Array | undefined>;
}
