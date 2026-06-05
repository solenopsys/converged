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
  CallFragmentInput,
  CallFragmentInfo,
  CallDeleteResult,
} from "../../types";
import type { CallEntity } from "./entities";

const RECORDING_PREFIX = "recordings";
const FRAGMENT_PREFIX = "fragments";

type CallFragmentEntity = {
  id: string;
  callId: string;
  audioId: string;
  source: "user" | "assistant";
  timestampNs: number;
  durationMs?: number | null;
  sizeBytes: number;
  kvsKey: string;
};

export class CallsStoreService {
  private readonly repo: CallRepository;

  constructor(
    private store: SqlStore,
    private recordings: KVStore,
    private fragments: KVStore,
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
    const audioId = input.audioId ?? id;

    this.recordings.put(this.buildRecordingKey(recordId), input.data);

    const entity: CallEntity = {
      id,
      startedAt,
      phone: input.phone,
      threadId: null,
      recordId,
      audioId,
      dialogue: "[]",
    };

    await this.repo.create(entity as any);
    return { callId: id, recordId, audioId };
  }

  async saveFragment(input: CallFragmentInput): Promise<CallFragmentInfo> {
    const existing = await this.repo.findById({ id: input.callId });
    if (!existing) {
      throw new Error(`Call not found: ${input.callId}`);
    }

    const id = generateULID();
    const audioId = input.audioId ?? existing.audioId ?? input.callId;
    const key = this.buildFragmentKey(
      input.callId,
      audioId,
      input.source,
      input.timestampNs,
      id,
    );
    const kvsKey = key.join(":");

    this.fragments.put(key, input.data);

    const row: CallFragmentEntity = {
      id,
      callId: input.callId,
      audioId,
      source: input.source,
      timestampNs: input.timestampNs,
      durationMs: input.durationMs ?? null,
      sizeBytes: input.data.byteLength,
      kvsKey,
    };

    await this.store.db.insertInto("call_fragments").values(row as any).execute();
    return this.toFragmentInfo(row);
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

  async deleteCall(id: CallId): Promise<CallDeleteResult> {
    const existing = await this.repo.findById({ id });
    if (!existing) {
      return { deleted: false, fragmentsDeleted: 0 };
    }

    const fragmentRows = (await this.store.db
      .selectFrom("call_fragments")
      .selectAll()
      .where("callId", "=", id)
      .execute()) as CallFragmentEntity[];

    let fragmentsDeleted = 0;
    for (const row of fragmentRows) {
      this.fragments.delete(row.kvsKey.split(":"));
      fragmentsDeleted += 1;
    }

    await this.store.db
      .deleteFrom("call_fragments")
      .where("callId", "=", id)
      .execute();

    this.recordings.delete(this.buildRecordingKey(existing.recordId));
    const deleted = await this.repo.delete({ id });

    return { deleted, fragmentsDeleted };
  }

  private toCall(entity: CallEntity): Call {
    const threadId = entity.threadId ?? undefined;
    return {
      id: entity.id,
      startedAt: entity.startedAt,
      phone: entity.phone,
      threadId,
      recordId: entity.recordId,
      audioId: entity.audioId ?? undefined,
    };
  }

  private toFragmentInfo(entity: CallFragmentEntity): CallFragmentInfo {
    return {
      id: entity.id,
      callId: entity.callId,
      audioId: entity.audioId,
      source: entity.source,
      timestampNs: entity.timestampNs,
      durationMs: entity.durationMs ?? undefined,
      sizeBytes: entity.sizeBytes,
      kvsKey: entity.kvsKey,
    };
  }

  private buildRecordingKey(recordId: CallRecordId): string[] {
    return [RECORDING_PREFIX, recordId];
  }

  private buildRecordId(data: Uint8Array): CallRecordId {
    const hashNum = Bun.hash(data);
    return hashNum.toString(16).padStart(16, "0");
  }

  private buildFragmentKey(
    callId: CallId,
    audioId: string,
    source: "user" | "assistant",
    timestampNs: number,
    fragmentId: string,
  ): string[] {
    return [
      FRAGMENT_PREFIX,
      callId,
      audioId,
      source,
      timestampNs.toString().padStart(20, "0"),
      fragmentId,
    ];
  }
}
