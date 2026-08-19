export type CallId = string;
export type CallRecordId = string;
export type CallAudioId = string;
export type CallFragmentId = string;

export type CacheRef = {
	cacheKey: string;
	sizeBytes?: number;
};

export type CallDialogueItem = {
	text: string;
	timestamp: number;
	who: string;
};

export type CallTranscriptItem = {
	time: number;
	source: "user" | "assistant";
	text: string;
};

export type Call = {
	id: CallId;
	startedAt: number;
	phone: string;
	threadId?: string;
	recordId: CallRecordId;
	audioId?: CallAudioId;

	title?: string;

	description?: string;

	processed?: boolean;

	flud?: boolean;
};

export type UpdateCallInput = {
	title?: string;
	description?: string;
	processed?: boolean;
	flud?: boolean;
};

export type CallRecordingInput = {
	startedAt?: number;
	phone: string;
	audioId?: CallAudioId;
	audioRef: CacheRef;
};

export type RegisterCallInput = {
	callId: CallId;
	startedAt: number;
	phone: string;
	threadId?: string;
	recordId?: CallRecordId;
	audioId?: CallAudioId;
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

	processed?: boolean;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type CallFragmentSource = "user" | "assistant";

export type CallFragmentInput = {
	callId: CallId;
	audioId?: CallAudioId;
	source: CallFragmentSource;
	timestampNs: number;
	durationMs?: number;
	audioRef: CacheRef;
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

export type AudioFragmentCacheRef = {
	cacheKey: string;
	source: CallFragmentSource;
	timestampNs: number;
	durationMs?: number;
	sizeBytes?: number;
};

export type DumpAudioFragmentsInput = {
	callId: CallId;
	audioId?: CallAudioId;
	fragments: AudioFragmentCacheRef[];
	deleteCache?: boolean;
};

export type DumpAudioFragmentsResult = {
	callId: CallId;
	audioId: CallAudioId;
	received: number;
	stored: number;
	missing: string[];
};

export type CallDeleteResult = {
	deleted: boolean;
	fragmentsDeleted: number;
};

export interface CallsService {
	registerCall(input: RegisterCallInput): Promise<Call>;
	saveRecording(input: CallRecordingInput): Promise<CallRecordingResult>;
	saveFragment(input: CallFragmentInput): Promise<CallFragmentInfo>;
	dumpAudioFragments(
		input: DumpAudioFragmentsInput,
	): Promise<DumpAudioFragmentsResult>;
	saveDialogue(input: CallDialogueInput): Promise<void>;

	getDialogue(id: CallId): Promise<CallDialogueItem[]>;

	getTranscript(id: CallId): Promise<CallTranscriptItem[]>;
	getCall(id: CallId): Promise<Call | undefined>;

	updateCall(id: CallId, patch: UpdateCallInput): Promise<Call>;
	listCalls(params: CallsListParams): Promise<PaginatedResult<Call>>;
	getRecording(recordId: CallRecordId): Promise<CacheRef | undefined>;

	getCallAudio(callId: CallId, source: CallFragmentSource): Promise<CacheRef>;

	hasCallAudio(callId: CallId): Promise<boolean>;
	deleteCall(id: CallId): Promise<CallDeleteResult>;
}
