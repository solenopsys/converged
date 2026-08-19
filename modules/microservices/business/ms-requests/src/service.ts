import { StoresController } from "./stores";
import type {
	PaginatedResult,
	Request,
	RequestId,
	RequestInput,
	RequestListParams,
	RequestMetrics,
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

async function publishBusinessEvent(
	type: string,
	entityId: string,
): Promise<void> {
	void type;
	void entityId;
	throw new Error(
		"[ms-requests] Direct service-to-service calls are forbidden. Publish this business event from a Centimanus workflow.",
	);

	// The old direct ms-requests -> ms-events HTTP call is intentionally disabled.
}

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

	async createRequest(input: RequestInput): Promise<RequestId> {
		await this.init();
		const id = await this.stores.requests.createRequest(input);
		void publishBusinessEvent("request.created", id);
		return id;
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

	async createRequestModel(input: RequestModelInput): Promise<RequestModel> {
		await this.init();
		const model = await this.stores.requests.createRequestModel(input);
		void publishBusinessEvent("request.created", model.id);
		return model;
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

	getRequestMetrics(): Promise<RequestMetrics> {
		return this.stores.requests.getRequestMetrics();
	}
}
