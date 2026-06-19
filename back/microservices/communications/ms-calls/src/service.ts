import type { CacheAdapter } from "back-core";
import { createThreadsServiceClient, MessageType } from "g-threads";
import { StoresController } from "./stores";
import type {
	CacheRef,
	Call,
	CallDeleteResult,
	CallDialogueInput,
	CallDialogueItem,
	CallTranscriptItem,
	CallFragmentInfo,
	CallFragmentInput,
	CallFragmentSource,
	CallId,
	CallRecordId,
	CallRecordingInput,
	CallRecordingResult,
	CallsListParams,
	CallsService,
	DumpAudioFragmentsInput,
	DumpAudioFragmentsResult,
	PaginatedResult,
	RegisterCallInput,
	UpdateCallInput,
} from "./types";

const MS_ID = "calls-ms";

export class CallsServiceImpl implements CallsService {
	private stores!: StoresController;
	private initPromise?: Promise<void>;
	private readonly cache?: CacheAdapter;

	constructor(config?: { cache?: CacheAdapter; valkey?: CacheAdapter }) {
		this.cache = config?.cache ?? config?.valkey;
		this.init();
	}

	private async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID, this.cache);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	private async ready(): Promise<void> {
		await this.init();
	}

	async registerCall(input: RegisterCallInput): Promise<Call> {
		await this.ready();
		return this.stores.calls.registerCall(input);
	}

	async saveRecording(input: CallRecordingInput): Promise<CallRecordingResult> {
		await this.ready();
		return this.stores.calls.saveRecording(input);
	}

	async saveFragment(input: CallFragmentInput): Promise<CallFragmentInfo> {
		await this.ready();
		return this.stores.calls.saveFragment(input);
	}

	async dumpAudioFragments(
		input: DumpAudioFragmentsInput,
	): Promise<DumpAudioFragmentsResult> {
		await this.ready();
		return this.stores.calls.dumpAudioFragments(input);
	}

	async saveDialogue(input: CallDialogueInput): Promise<void> {
		await this.ready();
		return this.stores.calls.saveDialogue(input);
	}

	async getDialogue(id: CallId): Promise<CallDialogueItem[]> {
		await this.ready();
		return this.stores.calls.getDialogue(id);
	}

	async getTranscript(id: CallId): Promise<CallTranscriptItem[]> {
		await this.ready();
		// The transcript lives in ms-threads (threadId === callId). The gate
		// writes each phrase there; we read it back so the admin UI has a single
		// call-facing API and never touches the gate.
		const baseUrl = process.env.SERVICES_BASE;
		if (!baseUrl) return [];
		try {
			const messages = await createThreadsServiceClient({ baseUrl }).readThread(
				id,
			);
			return messages
				.filter((m) => m.type === MessageType.message)
				.map((m) => ({
					time: Number(m.timestamp ?? 0),
					source: (m.user === "assistant" ? "assistant" : "user") as
						| "user"
						| "assistant",
					text: (m.data ?? "").trim(),
				}))
				.filter((it) => it.text.length > 0)
				.sort((a, b) => a.time - b.time);
		} catch (error) {
			console.warn("[ms-calls] getTranscript failed", id, error);
			return [];
		}
	}

	async getCall(id: CallId): Promise<Call | undefined> {
		await this.ready();
		return this.stores.calls.getCall(id);
	}

	async updateCall(id: CallId, patch: UpdateCallInput): Promise<Call> {
		await this.ready();
		return this.stores.calls.updateCall(id, patch);
	}

	async listCalls(params: CallsListParams): Promise<PaginatedResult<Call>> {
		await this.ready();
		return this.stores.calls.listCalls(params);
	}

	async getRecording(recordId: CallRecordId): Promise<CacheRef | undefined> {
		await this.ready();
		return this.stores.calls.getRecording(recordId);
	}

	async getCallAudio(
		callId: CallId,
		source: CallFragmentSource,
	): Promise<CacheRef> {
		await this.ready();
		return this.stores.calls.getCallAudio(callId, source);
	}

	async hasCallAudio(callId: CallId): Promise<boolean> {
		await this.ready();
		return this.stores.calls.hasCallAudio(callId);
	}

	async deleteCall(id: CallId): Promise<CallDeleteResult> {
		await this.ready();
		return this.stores.calls.deleteCall(id);
	}
}

export default CallsServiceImpl;
