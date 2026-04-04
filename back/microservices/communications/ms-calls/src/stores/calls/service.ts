import { SqlStore, KVStore, generateULID } from "back-core";
import { CallRepository } from "./entities";
import type {
  Call,
  CallId,
  CallRecordId,
  CallsListParams,
  PaginatedResult,
  CallRecordingInput,
  CallRecordingResult,
  CallDialogueInput,
} from "../../types";
import type { CallEntity } from "./entities";

const RECORDING_PREFIX = "recordings";

export class CallsStoreService {
  private readonly repo: CallRepository;

  constructor(
    private store: SqlStore,
    private recordings: KVStore,
  ) {
    this.repo = new CallRepository(store, "calls", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async saveRecording(input: CallRecordingInput): Promise<CallRecordingResult> {
    const id = generateULID();
    const startedAt = input.startedAt ?? Date.now();
    const recordId = this.buildRecordId(input.data);

    this.recordings.put(this.buildRecordingKey(recordId), input.data);

    const entity: CallEntity = {
      id,
      startedAt,
      phone: input.phone,
      threadId: null,
      recordId,
      dialogue: "[]",
    };

    await this.repo.create(entity as any);
    return { callId: id, recordId };
  }

  async saveDialogue(input: CallDialogueInput): Promise<void> {
    const existing = await this.repo.findById({ id: input.callId });
    if (!existing) {
      throw new Error(`Call not found: ${input.callId}`);
    }

    const update: Partial<CallEntity> = {
      threadId: input.threadId ?? existing.threadId ?? null,
      dialogue: JSON.stringify(input.dialogue ?? []),
    };

    await this.repo.update({ id: input.callId }, update);
  }

  async getCall(id: CallId): Promise<Call | undefined> {
    const entity = await this.repo.findById({ id });
    if (!entity) {
      return undefined;
    }
    return this.toCall(entity);
  }

  async listCalls(params: CallsListParams): Promise<PaginatedResult<Call>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("calls").selectAll();
    if (params.phone) {
      query = query.where("phone", "=", params.phone);
    }
    if (params.fromTime !== undefined) {
      query = query.where("startedAt", ">=", params.fromTime);
    }
    if (params.toTime !== undefined) {
      query = query.where("startedAt", "<=", params.toTime);
    }

    const items = await query
      .orderBy("startedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("calls")
      .select(({ fn }) => fn.countAll().as("count"));
    if (params.phone) {
      countQuery = countQuery.where("phone", "=", params.phone);
    }
    if (params.fromTime !== undefined) {
      countQuery = countQuery.where("startedAt", ">=", params.fromTime);
    }
    if (params.toTime !== undefined) {
      countQuery = countQuery.where("startedAt", "<=", params.toTime);
    }
    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as CallEntity[]).map((item) => this.toCall(item)),
      totalCount,
    };
  }

  async getRecording(recordId: CallRecordId): Promise<Uint8Array | undefined> {
    const data = this.recordings.get(this.buildRecordingKey(recordId));
    if (!data) {
      return undefined;
    }
    if (data instanceof Uint8Array) {
      return data;
    }
    if (Buffer.isBuffer(data)) {
      return new Uint8Array(data);
    }
    if (typeof data === "string") {
      return new TextEncoder().encode(data);
    }
    return undefined;
  }

  private toCall(entity: CallEntity): Call {
    const threadId = entity.threadId ?? undefined;
    return {
      id: entity.id,
      startedAt: entity.startedAt,
      phone: entity.phone,
      threadId,
      recordId: entity.recordId,
    };
  }

  private buildRecordingKey(recordId: CallRecordId): string[] {
    return [RECORDING_PREFIX, recordId];
  }

  private buildRecordId(data: Uint8Array): CallRecordId {
    const hashNum = Bun.hash(data);
    return hashNum.toString(16).padStart(16, "0");
  }
}
