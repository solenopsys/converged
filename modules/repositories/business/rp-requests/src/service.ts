import { createServerNrpcClientConfig } from "back-core";
import { createEventsServiceClient } from "g-events";
import { createPushRouterServiceClient } from "g-pushrouter";
import { createStaffServiceClient } from "g-staff";
import { getCurrentWorkspaceContext } from "nrpc";
import { announceRequestCreated } from "./request-events";
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
	SelectionDescriptor,
	SelectionStats,
} from "./types";

const REPOSITORY_ID = "rp-requests";

/** Who is calling, from the verified token and from nothing else. */
function requireActor(): string {
	const actor = getCurrentWorkspaceContext()?.user?.trim();
	if (!actor) throw new Error("Authenticated caller is required");
	return actor;
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
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	async createRequest(input: RequestInput): Promise<RequestId> {
		await this.init();
		const actor = requireActor();
		const id = await this.stores.requests.createRequest(input, actor);
		try {
			const config = createServerNrpcClientConfig();
			await announceRequestCreated(id, input, actor, {
				staff: createStaffServiceClient(config),
				events: createEventsServiceClient(config),
				push: createPushRouterServiceClient(config),
				grant: (userId) => this.stores.requests.access.grantToUser(id, userId),
			});
		} catch (error) {
			// The request is committed; a notification outage must not turn its
			// successful creation into an error that encourages a duplicate retry.
			console.warn("[rp-requests] request event unavailable", id, error);
		}
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
		const id = await this.createRequest({
			...input,
			fields: input.fields ?? {},
		});
		const model = await this.stores.requests.getRequestModel(id);
		if (!model) throw new Error(`Request not found after creation: ${id}`);
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

	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		if (objectType !== "requests.request") {
			throw new Error(`Unsupported request selection object: ${objectType}`);
		}
		return {
			objectType,
			title: "Manufacturing requests",
			fields: [
				{
					id: "source",
					label: "Source",
					valueType: "string",
					operators: ["eq", "in", "contains", "isNull"],
				},
				{
					id: "status",
					label: "Status",
					valueType: "enum",
					operators: ["eq", "in", "notEq", "notIn"],
				},
				{
					id: "createdAt",
					label: "Created",
					valueType: "date",
					operators: ["gte", "lte", "between"],
				},
			],
			filterExample: { status: { eq: "new" } },
			revision: "requests-v1",
		};
	}

	async inspectRequests(
		filter?: Record<string, unknown>,
	): Promise<SelectionStats> {
		await this.init();
		return { totalCount: await this.stores.requests.countRequests(filter) };
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
