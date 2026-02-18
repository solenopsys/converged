import { SqlStore, generateULID } from "back-core";
import { RequestRepository, RequestProcessingRepository } from "./entities";
import type {
  Request,
  RequestInput,
  RequestId,
  RequestListParams,
  PaginatedResult,
  RequestFields,
  RequestFiles,
  RequestStatus,
  RequestProcessingEntry,
} from "../../types";
import type { RequestEntity, RequestProcessingEntity } from "./entities";

export class RequestsStoreService {
  private readonly repo: RequestRepository;
  private readonly processingRepo: RequestProcessingRepository;

  constructor(private store: SqlStore) {
    this.repo = new RequestRepository(store, "requests", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
    this.processingRepo = new RequestProcessingRepository(
      store,
      "request_processing",
      {
        primaryKey: "id",
        extractKey: (entry) => ({ id: entry.id }),
        buildWhereCondition: (key) => ({ id: key.id }),
      },
    );
  }

  async createRequest(input: RequestInput): Promise<RequestId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    const status = input.status ?? "new";
    const entity: RequestEntity = {
      id,
      source: input.source ?? "",
      status,
      fields: this.serializeMap(input.fields),
      files: this.serializeMap(input.files ?? {}),
      createdAt,
    };

    await this.repo.create(entity as any);
    return id;
  }

  async getRequest(id: RequestId): Promise<Request | undefined> {
    const entity = await this.repo.findById({ id });
    if (!entity) {
      return undefined;
    }
    return this.toRequest(entity);
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
      items: (items as RequestEntity[]).map((item) => this.toRequest(item)),
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

    const createdAt = new Date().toISOString();
    const logEntry: RequestProcessingEntity = {
      id: generateULID(),
      requestId: id,
      status,
      actor,
      comment: comment ?? "",
      createdAt,
    };
    await this.processingRepo.create(logEntry as any);
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

  private toRequest(entity: RequestEntity): Request {
    const source = entity.source ?? "";
    return {
      id: entity.id,
      source: source.length > 0 ? source : undefined,
      status: entity.status,
      fields: this.parseMap(entity.fields) as RequestFields,
      files: this.parseMap(entity.files) as RequestFiles,
      createdAt: entity.createdAt,
    };
  }
}
