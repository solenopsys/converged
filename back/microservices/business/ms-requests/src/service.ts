import { StoresController } from "./stores";
import type {
	PaginatedResult,
	Request,
	RequestId,
	RequestInput,
	RequestListParams,
	RequestPatch,
	RequestProcessingEntry,
	RequestStatus,
	RequestsService,
} from "./types";

const MS_ID = "requests-ms";

export class RequestsServiceImpl implements RequestsService {
	stores: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	createRequest(input: RequestInput): Promise<RequestId> {
		return this.stores.requests.createRequest(input);
	}

	getRequest(id: RequestId): Promise<Request | undefined> {
		return this.stores.requests.getRequest(id);
	}

	patchRequest(
		id: RequestId,
		patch: RequestPatch,
		actor: string,
		comment?: string,
	): Promise<void> {
		return this.stores.requests.patchRequest(id, patch, actor, comment);
	}

	listRequests(params: RequestListParams): Promise<PaginatedResult<Request>> {
		return this.stores.requests.listRequests(params);
	}

	updateStatus(
		id: RequestId,
		status: RequestStatus,
		actor: string,
		comment?: string,
	): Promise<void> {
		return this.stores.requests.updateStatus(id, status, actor, comment);
	}

	listProcessing(requestId: RequestId): Promise<RequestProcessingEntry[]> {
		return this.stores.requests.listProcessing(requestId);
	}
}
