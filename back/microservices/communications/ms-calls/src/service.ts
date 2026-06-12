import type {
  CallsService,
  Call,
  CallId,
  CallRecordId,
  CallsListParams,
  PaginatedResult,
  CallRecordingInput,
  CallRecordingResult,
  CallDialogueInput,
  CallFragmentInput,
  CallFragmentInfo,
  CallFragmentSource,
  CallDeleteResult,
  CallContext,
  CallContextListParams,
  CallContextName,
  CallContextSummary,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "calls-ms";

export class CallsServiceImpl implements CallsService {
  private stores!: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async saveRecording(input: CallRecordingInput): Promise<CallRecordingResult> {
    await this.ready();
    return this.stores.calls.saveRecording(input);
  }

  async saveFragment(input: CallFragmentInput): Promise<CallFragmentInfo> {
    await this.ready();
    return this.stores.calls.saveFragment(input);
  }

  async saveDialogue(input: CallDialogueInput): Promise<void> {
    await this.ready();
    return this.stores.calls.saveDialogue(input);
  }

  async getCall(id: CallId): Promise<Call | undefined> {
    await this.ready();
    return this.stores.calls.getCall(id);
  }

  async listCalls(params: CallsListParams): Promise<PaginatedResult<Call>> {
    await this.ready();
    return this.stores.calls.listCalls(params);
  }

  async getRecording(recordId: CallRecordId): Promise<Uint8Array | undefined> {
    await this.ready();
    return this.stores.calls.getRecording(recordId);
  }

  async getCallAudio(
    callId: CallId,
    source: CallFragmentSource,
  ): Promise<Uint8Array> {
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

  async saveContext(
    name: CallContextName,
    context: unknown,
  ): Promise<CallContextSummary> {
    await this.ready();
    return this.stores.contexts.saveContext(name, context);
  }

  async getContext(name: CallContextName): Promise<CallContext | null> {
    await this.ready();
    return this.stores.contexts.getContext(name);
  }

  async listContexts(
    params: CallContextListParams,
  ): Promise<PaginatedResult<CallContextSummary>> {
    await this.ready();
    return this.stores.contexts.listContexts(params);
  }

  async deleteContext(name: CallContextName): Promise<boolean> {
    await this.ready();
    return this.stores.contexts.deleteContext(name);
  }
}

export default CallsServiceImpl;
