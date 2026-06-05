export type CallId = string;
export type CallRecordId = string;
export type CallAudioId = string;
export type CallFragmentId = string;

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
  audioId?: CallAudioId;
};

export type CallRecordingInput = {
  startedAt?: number;
  phone: string;
  audioId?: CallAudioId;
  data: Uint8Array;
};

export type CallRecordingResult = {
  callId: CallId;
  recordId: CallRecordId;
  audioId: CallAudioId;
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

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export type CallFragmentSource = "user" | "assistant";

export type CallFragmentInput = {
  callId: CallId;
  audioId?: CallAudioId;
  source: CallFragmentSource;
  timestampNs: number;
  durationMs?: number;
  data: Uint8Array;
};

export type CallFragmentInfo = {
  id: CallFragmentId;
  callId: CallId;
  audioId: CallAudioId;
  source: CallFragmentSource;
  timestampNs: number;
  durationMs?: number;
  sizeBytes: number;
  kvsKey: string;
};

export type CallDeleteResult = {
  deleted: boolean;
  fragmentsDeleted: number;
};

export interface CallsService {
  saveRecording(input: CallRecordingInput): Promise<CallRecordingResult>;
  saveFragment(input: CallFragmentInput): Promise<CallFragmentInfo>;
  saveDialogue(input: CallDialogueInput): Promise<void>;
  getCall(id: CallId): Promise<Call | undefined>;
  listCalls(params: CallsListParams): Promise<PaginatedResult<Call>>;
  getRecording(recordId: CallRecordId): Promise<Uint8Array | undefined>;
  deleteCall(id: CallId): Promise<CallDeleteResult>;
}
