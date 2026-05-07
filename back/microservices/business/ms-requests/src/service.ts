import { StoresController } from "./stores";
import type {
	PaginatedResult,
	Request,
	RequestId,
	RequestInput,
	RequestListParams,
	RequestModel,
	RequestModelInput,
	RequestModelPatch,
	RequestPatch,
	RequestProcessingEntry,
	RequestProcessType,
	RequestRequirementProfile,
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

	getRequestModel(id: RequestId): Promise<RequestModel | undefined> {
		return this.stores.requests.getRequestModel(id);
	}

	getRequestRequirementProfile(
		processType: RequestProcessType,
	): Promise<RequestRequirementProfile | undefined> {
		return this.stores.requests.getRequestRequirementProfile(processType);
	}

	listRequestRequirementProfiles(): Promise<RequestRequirementProfile[]> {
		return this.stores.requests.listRequestRequirementProfiles();
	}

	createRequestModel(input: RequestModelInput): Promise<RequestModel> {
		return this.stores.requests.createRequestModel(input);
	}

	applyRequestUpdate(
		id: RequestId,
		patch: RequestModelPatch,
		actor: string,
		comment?: string,
	): Promise<RequestModel> {
		return this.stores.requests.applyRequestUpdate(id, patch, actor, comment);
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
