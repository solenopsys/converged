import { generateULID, type SqlStore } from "back-core";
import type {
	PaginatedResult,
	Request,
	RequestFields,
	RequestFiles,
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
} from "../../types";
import type { RequestEntity, RequestProcessingEntity } from "./entities";
import { RequestRepository } from "./entities";
import type { RequestRequirementsProvider } from "../requirements/service";
import { buildRequestModel, inferRequestProcessType, snapshotFields } from "./model";

export class RequestsStoreService {
	private readonly repo: RequestRepository;

	constructor(
		private store: SqlStore,
		private requirements?: RequestRequirementsProvider,
	) {
		this.repo = new RequestRepository(store, "requests", {
			primaryKey: "id",
			extractKey: (entry) => ({ id: entry.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
	}

	async createRequest(input: RequestInput): Promise<RequestId> {
		const id = generateULID();
		const createdAt = new Date().toISOString();
		const status = input.status ?? "new";
		const profiles = await this.listRequirementProfiles();
		const processType = inferRequestProcessType({
			source: input.source,
			processType: input.processType,
			title: input.title,
			summary: input.summary,
			fields: input.fields,
		}, profiles);
		const requirementProfile = await this.getRequirementProfile(processType);
		const model = buildRequestModel({
			id,
			source: input.source,
			status,
			processType,
			title: input.title,
			summary: input.summary,
			fields: input.fields,
			parameters: input.parameters,
			fieldDefinitions: input.fieldDefinitions,
			requirementProfile,
			files: input.files ?? {},
			createdAt,
			updatedAt: createdAt,
		});
		const entity: RequestEntity = {
			id,
			source: input.source ?? "",
			status,
			fields: this.serializeMap(snapshotFields(model)),
			files: this.serializeMap(model.files),
			model: this.serializeJson(model),
			createdAt,
			updatedAt: createdAt,
		};

		await this.store.db
			.insertInto("requests")
			.values(entity as any)
			.execute();
		return id;
	}

	async createRequestModel(input: RequestModelInput): Promise<RequestModel> {
		const id = await this.createRequest({
			source: input.source,
			status: input.status,
			processType: input.processType,
			title: input.title,
			summary: input.summary,
			fields: input.fields ?? {},
			parameters: input.parameters,
			fieldDefinitions: input.fieldDefinitions,
			files: input.files,
		});
		const model = await this.getRequestModel(id);
		if (!model) {
			throw new Error(`Request not found after creation: ${id}`);
		}
		return model;
	}

	async getRequest(id: RequestId): Promise<Request | undefined> {
		const entity = await this.repo.findById({ id });
		if (!entity) {
			return undefined;
		}
		return this.toRequest(entity);
	}

	async getRequestModel(id: RequestId): Promise<RequestModel | undefined> {
		const entity = await this.repo.findById({ id });
		if (!entity) {
			return undefined;
		}
		return this.toModel(entity);
	}

	async getRequestRequirementProfile(
		processType: RequestProcessType,
	): Promise<RequestRequirementProfile | undefined> {
		return this.requirements?.getProfile(processType);
	}

	async listRequestRequirementProfiles(): Promise<RequestRequirementProfile[]> {
		return this.requirements?.listProfiles() ?? [];
	}

	async applyRequestUpdate(
		id: RequestId,
		patch: RequestModelPatch,
		actor: string,
		comment?: string,
	): Promise<RequestModel> {
		const existing = await this.repo.findById({ id });
		if (!existing) {
			throw new Error(`Request not found: ${id}`);
		}

		const previous = await this.toModel(existing);
		const nextStatus = patch.status ?? existing.status;
		const profiles = await this.listRequirementProfiles();
		const processType =
			patch.processType ??
			inferRequestProcessType({
				source: patch.source ?? existing.source ?? previous.source,
				processType: previous.processType,
				title: patch.title ?? previous.title,
				summary: patch.summary ?? previous.summary,
				fields: patch.fields,
				previous,
			}, profiles);
		const requirementProfile = await this.getRequirementProfile(processType);
		const model = buildRequestModel({
			id,
			source: patch.source ?? existing.source ?? previous.source,
			status: nextStatus,
			processType,
			title: patch.title ?? previous.title,
			summary: patch.summary ?? previous.summary,
			fields: patch.fields,
			parameters: patch.parameters,
			fieldDefinitions: patch.fieldDefinitions,
			requirementProfile,
			files: patch.files,
			createdAt: existing.createdAt,
			updatedAt: new Date().toISOString(),
			previous,
		});

		await this.repo.update(
			{ id },
			{
				source: model.source ?? "",
				status: model.status,
				fields: this.serializeMap(snapshotFields(model)),
				files: this.serializeMap(model.files),
				model: this.serializeJson(model),
				updatedAt: model.updatedAt,
			} as any,
		);

		await this.recordProcessing(
			id,
			model.status,
			actor,
			comment ?? "updated request model",
		);

		return model;
	}

	async patchRequest(
		id: RequestId,
		patch: RequestPatch,
		actor: string,
		comment?: string,
	): Promise<void> {
		await this.applyRequestUpdate(id, patch, actor, comment ?? "patched request");
	}

	async listRequests(
		params: RequestListParams,
	): Promise<PaginatedResult<Request>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		let query = this.store.db.selectFrom("requests").selectAll();
		if (params.source) {
			query = query.where("source", "=", params.source);
		}

		const items = await query
			.orderBy("createdAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		let countQuery = this.store.db
			.selectFrom("requests")
			.select(({ fn }) => fn.countAll().as("count"));
		if (params.source) {
			countQuery = countQuery.where("source", "=", params.source);
		}
		const countResult = await countQuery.executeTakeFirst();
		const totalCount = Number(countResult?.count ?? 0);

		return {
			items: await Promise.all(
				(items as RequestEntity[]).map((item) => this.toRequest(item)),
			),
			totalCount,
		};
	}

	async updateStatus(
		id: RequestId,
		status: RequestStatus,
		actor: string,
		comment?: string,
	): Promise<void> {
		const existing = await this.repo.findById({ id });
		if (!existing) {
			throw new Error(`Request not found: ${id}`);
		}

		await this.repo.update({ id }, { status });

		await this.recordProcessing(id, status, actor, comment ?? "");
	}

	async listProcessing(
		requestId: RequestId,
	): Promise<RequestProcessingEntry[]> {
		const items = await this.store.db
			.selectFrom("request_processing")
			.selectAll()
			.where("requestId", "=", requestId)
			.orderBy("createdAt", "asc")
			.execute();

		return items as RequestProcessingEntry[];
	}

	private serializeMap(value: RequestFields | RequestFiles): string {
		return JSON.stringify(value ?? {});
	}

	private serializeJson(value: unknown): string {
		return JSON.stringify(value ?? {});
	}

	private parseMap(value: string | null | undefined): Record<string, any> {
		if (!value) {
			return {};
		}
		try {
			return JSON.parse(value);
		} catch {
			return {};
		}
	}

	private parseJson<T>(value: string | null | undefined): T | undefined {
		if (!value) return undefined;
		try {
			return JSON.parse(value) as T;
		} catch {
			return undefined;
		}
	}

	private async recordProcessing(
		requestId: RequestId,
		status: RequestStatus,
		actor: string,
		comment: string,
	): Promise<void> {
		const logEntry: RequestProcessingEntity = {
			id: generateULID(),
			requestId,
			status,
			actor,
			comment,
			createdAt: new Date().toISOString(),
		};

		await this.store.db
			.insertInto("request_processing")
			.values(logEntry as any)
			.execute();
	}

	private async getRequirementProfile(
		processType: RequestProcessType,
	): Promise<RequestRequirementProfile | undefined> {
		return this.requirements?.getProfile(processType);
	}

	private async listRequirementProfiles(): Promise<RequestRequirementProfile[]> {
		return this.requirements?.listProfiles() ?? [];
	}

	private getRequirementProfileSync(
		processType: RequestProcessType,
	): RequestRequirementProfile | undefined {
		return this.requirements?.getProfileSync?.(processType);
	}

	private async toRequest(entity: RequestEntity): Promise<Request> {
		const source = entity.source ?? "";
		const model = await this.toModel(entity);
		return {
			id: entity.id,
			source: source.length > 0 ? source : undefined,
			status: entity.status,
			fields: this.parseMap(entity.fields) as RequestFields,
			files: this.parseMap(entity.files) as RequestFiles,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? entity.createdAt,
			model,
		};
	}

	private async toModel(entity: RequestEntity): Promise<RequestModel> {
		const previous = this.parseJson<RequestModel>(entity.model);
		const processType = previous?.processType ?? "generic";
		const requirementProfile =
			this.getRequirementProfileSync(processType) ??
			(await this.getRequirementProfile(processType));
		const model = buildRequestModel({
			id: entity.id,
			source: entity.source ?? previous?.source,
			status: entity.status,
			processType,
			title: previous?.title,
			summary: previous?.summary,
			fields: this.parseMap(entity.fields) as RequestFields,
			files: this.parseMap(entity.files) as RequestFiles,
			requirementProfile,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? previous?.updatedAt ?? entity.createdAt,
			previous,
		});
		return {
			...model,
			revision: previous?.revision ?? model.revision,
		};
	}
}
