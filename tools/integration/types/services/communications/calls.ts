export type CallId = string;
export type CallRecordId = string;
export type CallAudioId = string;
export type CallFragmentId = string;
export type CallContextName = string;

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

export type CallContext = {
  id: CallContextName;
  name: CallContextName;
  updatedAt: number;
  data: unknown;
  legacyKey?: string;
};

export type CallContextSummary = {
  id: CallContextName;
  name: CallContextName;
  updatedAt: number;
  size?: number;
  legacyKey?: string;
};

export type CallContextListParams = {
  offset: number;
  limit: number;
};

export interface CallsService {
  saveRecording(input: CallRecordingInput): Promise<CallRecordingResult>;
  saveFragment(input: CallFragmentInput): Promise<CallFragmentInfo>;
  saveDialogue(input: CallDialogueInput): Promise<void>;
  getCall(id: CallId): Promise<Call | undefined>;
  listCalls(params: CallsListParams): Promise<PaginatedResult<Call>>;
  getRecording(recordId: CallRecordId): Promise<Uint8Array | undefined>;
  /**
   * Build a playable WebM/Opus recording on demand from stored Opus frames.
   * Strict Uint8Array return (no union) so nrpc resolves the binary handler by
   * name; empty audio comes back as a zero-length array.
   */
  getCallAudio(callId: CallId, source: CallFragmentSource): Promise<Uint8Array>;
  /** Cheap check whether any Opus audio was captured for a call. */
  hasCallAudio(callId: CallId): Promise<boolean>;
  deleteCall(id: CallId): Promise<CallDeleteResult>;
  saveContext(name: CallContextName, context: unknown): Promise<CallContextSummary>;
  getContext(name: CallContextName): Promise<CallContext | null>;
  listContexts(params: CallContextListParams): Promise<PaginatedResult<CallContextSummary>>;
  deleteContext(name: CallContextName): Promise<boolean>;
}
