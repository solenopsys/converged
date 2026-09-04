import type { CacheAdapter } from "back-core";
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
	FilterObject,
	CallsService,
	DumpAudioFragmentsInput,
	DumpAudioFragmentsResult,
	PaginatedResult,
	RegisterCallInput,
	SelectionDescriptor,
	SelectionStats,
	UpdateCallInput,
} from "./types";

const REPOSITORY_ID = "rp-calls";

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
			this.stores = new StoresController(REPOSITORY_ID, this.cache);
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
		void id;
		throw new Error(
			"[rp-calls] Direct service-to-service calls are forbidden. Centimanus must write the dialogue into rp-calls through saveDialogue.",
		);

		// The old direct rp-calls -> rp-threads HTTP call is intentionally disabled.
		// The corresponding business flow belongs to the Centimanus DAG.
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

	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		if (objectType !== "calls.call") throw new Error(`Unsupported calls selection object: ${objectType}`);
		return { objectType, title: "Calls", fields: [
			{ id: "phone", label: "Phone", valueType: "string", operators: ["eq", "in", "contains"] },
			{ id: "startedAt", label: "Started", valueType: "number", operators: ["gt", "gte", "lt", "lte", "between"] },
			{ id: "processed", label: "Processed", valueType: "boolean", operators: ["eq", "notEq"] },
		], revision: "calls-v1" };
	}

	async inspectCalls(filter?: FilterObject): Promise<SelectionStats> {
		await this.ready();
		return { totalCount: await this.stores.calls.countCalls(filter) };
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
