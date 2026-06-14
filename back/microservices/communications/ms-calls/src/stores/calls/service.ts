import { SqlStore, KVStore, generateULID } from "back-core";
import { CallRepository } from "./entities";
import { writeWebMOpus } from "./webm";
import {
  trimSilence,
  silenceTrimConfigFromEnv,
  type SilenceTrimConfig,
} from "./silence";
import type {
  Call,
  CallId,
  CallRecordId,
  CallsListParams,
  PaginatedResult,
  CallRecordingInput,
  CallRecordingResult,
  CallDialogueInput,
  CallDialogueItem,
  CallFragmentInput,
  CallFragmentInfo,
  CallDeleteResult,
  UpdateCallInput,
} from "../../types";
import type { CallEntity } from "./entities";

const RECORDING_PREFIX = "recordings";
const FRAGMENT_PREFIX = "fragments";

/**
 * Key prefix llm-audio-gate uses when it writes raw Opus frames straight into
 * this microservice's `fragments` KV store: `llm-audio:<callId>:<source>:<ts>`,
 * where <callId> is the gate session id (== calls.id) and <ts> is a 20-digit
 * zero-padded nanosecond timestamp. We read these back to build playable audio.
 */
const GATE_AUDIO_PREFIX = "llm-audio";

/** Opus over WebRTC is always a 48 kHz / mono stream of 20 ms frames. */
const OPUS_SAMPLE_RATE = 48000;
const OPUS_CHANNELS = 1;

export type CallAudioSource = "user" | "assistant";

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
  private readonly silenceTrim: SilenceTrimConfig = silenceTrimConfigFromEnv();

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
      title: null,
      description: null,
      processed: 0,
      flud: 0,
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

  async getDialogue(id: CallId): Promise<CallDialogueItem[]> {
    const existing = await this.repo.findById({ id });
    if (!existing) {
      return [];
    }
    return this.parseDialogue(existing.dialogue);
  }

  async updateCall(id: CallId, patch: UpdateCallInput): Promise<Call> {
    const existing = await this.repo.findById({ id });
    if (!existing) {
      throw new Error(`Call not found: ${id}`);
    }

    const update: Partial<CallEntity> = {};
    if (patch.title !== undefined) {
      update.title = patch.title ?? null;
    }
    if (patch.description !== undefined) {
      update.description = patch.description ?? null;
    }
    if (patch.processed !== undefined) {
      update.processed = patch.processed ? 1 : 0;
    }
    if (patch.flud !== undefined) {
      update.flud = patch.flud ? 1 : 0;
    }

    if (Object.keys(update).length > 0) {
      await this.repo.update({ id }, update);
    }

    const updated = await this.repo.findById({ id });
    if (!updated) {
      throw new Error(`Failed to update call: ${id}`);
    }
    return this.toCall(updated);
  }

  private parseDialogue(raw: string): CallDialogueItem[] {
    try {
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? (parsed as CallDialogueItem[]) : [];
    } catch {
      return [];
    }
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
    if (params.processed !== undefined) {
      query = query.where("processed", "=", params.processed ? 1 : 0);
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
    if (params.processed !== undefined) {
      countQuery = countQuery.where("processed", "=", params.processed ? 1 : 0);
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

  /**
   * Build a playable WebM/Opus file on demand from the Opus frames the gate
   * stored for this call + source. Frames are laid out sequentially at 20 ms
   * each (see webm.ts). Returns undefined when no audio was captured.
   */
  getCallAudio(callId: CallId, source: CallAudioSource): Uint8Array {
    // Drop the dead air the gate captured (leading/trailing silence + long
    // mid-call pauses) before muxing, so playback and the waveform reflect the
    // actual conversation instead of seconds of nothing. See silence.ts.
    const frames = trimSilence(
      this.readOpusFrames(callId, source),
      this.silenceTrim,
    );
    return (
      writeWebMOpus(frames, {
        sampleRate: OPUS_SAMPLE_RATE,
        channels: OPUS_CHANNELS,
      }) ?? new Uint8Array(0)
    );
  }

  /** Cheap presence check for the calls list "rec" badge — no muxing. */
  hasCallAudio(callId: CallId): boolean {
    return (
      this.countAudioFrames(callId, "user") > 0 ||
      this.countAudioFrames(callId, "assistant") > 0
    );
  }

  private countAudioFrames(callId: CallId, source: CallAudioSource): number {
    return this.fragments.listKeys([GATE_AUDIO_PREFIX, callId, source]).length;
  }

  /** Read the gate's Opus frames for a call/source, ordered chronologically. */
  private readOpusFrames(callId: CallId, source: CallAudioSource): Uint8Array[] {
    const keys = this.fragments.listKeys([GATE_AUDIO_PREFIX, callId, source]);
    // Keys end in a 20-digit zero-padded timestamp, so lexical order is
    // chronological — sort explicitly rather than trust the scan order.
    keys.sort();

    const frames: Uint8Array[] = [];
    for (const key of keys) {
      const value = this.fragments.getDirect(key);
      if (Buffer.isBuffer(value)) {
        if (value.length > 0) frames.push(new Uint8Array(value));
      } else if (value instanceof Uint8Array) {
        if (value.length > 0) frames.push(value);
      }
    }
    return frames;
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

    // Drop the gate's raw Opus frames (llm-audio:<id>:<source>:*) too, so the
    // on-demand audio has nothing left to rebuild from.
    for (const source of ["user", "assistant"] as const) {
      for (const key of this.fragments.listKeys([GATE_AUDIO_PREFIX, id, source])) {
        this.fragments.delete(key.split(":"));
      }
    }

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
      title: entity.title ?? undefined,
      description: entity.description ?? undefined,
      processed: entity.processed === 1,
      flud: entity.flud === 1,
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
