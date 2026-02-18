import { SqlStore, generateULID } from "back-core";
import type {
  Camera,
  CameraId,
  CameraInput,
  VideoStream,
  VideoStreamId,
  VideoStreamInput,
  VideoSegment,
  VideoSegmentId,
  VideoSegmentInput,
  VideoSegmentListParams,
  PaginationParams,
  PaginatedResult,
} from "../types";

export class VideoMetadataStoreService {
  constructor(private store: SqlStore) {}

  async createCamera(input: CameraInput): Promise<CameraId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    await this.store.db
      .insertInto("cameras")
      .values({ id, name: input.name, createdAt })
      .execute();
    return id;
  }

  async getCamera(id: CameraId): Promise<Camera | null> {
    const row = await this.store.db
      .selectFrom("cameras")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? (row as Camera) : null;
  }

  async listCameras(
    params: PaginationParams,
  ): Promise<PaginatedResult<Camera>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.store.db
      .selectFrom("cameras")
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const count = await this.store.db
      .selectFrom("cameras")
      .select(({ fn }) => fn.countAll().as("count"))
      .executeTakeFirst();

    return {
      items: items as Camera[],
      totalCount: Number(count?.count ?? 0),
    };
  }

  async deleteCamera(id: CameraId): Promise<boolean> {
    await this.store.db.deleteFrom("cameras").where("id", "=", id).execute();
    return true;
  }

  async createStream(input: VideoStreamInput): Promise<VideoStreamId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    await this.store.db
      .insertInto("video_streams")
      .values({
        id,
        cameraId: input.cameraId,
        name: input.name,
        resolution: input.resolution,
        fps: input.fps,
        createdAt,
      })
      .execute();
    return id;
  }

  async getStream(id: VideoStreamId): Promise<VideoStream | null> {
    const row = await this.store.db
      .selectFrom("video_streams")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? (row as VideoStream) : null;
  }

  async listStreams(
    cameraId: CameraId,
    params: PaginationParams,
  ): Promise<PaginatedResult<VideoStream>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.store.db
      .selectFrom("video_streams")
      .selectAll()
      .where("cameraId", "=", cameraId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const count = await this.store.db
      .selectFrom("video_streams")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("cameraId", "=", cameraId)
      .executeTakeFirst();

    return {
      items: items as VideoStream[],
      totalCount: Number(count?.count ?? 0),
    };
  }

  async deleteStream(id: VideoStreamId): Promise<boolean> {
    await this.store.db
      .deleteFrom("video_streams")
      .where("id", "=", id)
      .execute();
    return true;
  }

  async saveSegment(input: VideoSegmentInput): Promise<VideoSegmentId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    await this.store.db
      .insertInto("video_segments")
      .values({
        id,
        streamId: input.streamId,
        startTime: input.startTime,
        endTime: input.endTime,
        hash: input.hash,
        thumbPath: input.thumbPath ?? null,
        createdAt,
      })
      .execute();
    return id;
  }

  async getSegment(id: VideoSegmentId): Promise<VideoSegment | null> {
    const row = await this.store.db
      .selectFrom("video_segments")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) {
      return null;
    }
    const segment = row as VideoSegment;
    if (!segment.thumbPath) {
      delete (segment as any).thumbPath;
    }
    return segment;
  }

  async listSegments(
    params: VideoSegmentListParams,
  ): Promise<PaginatedResult<VideoSegment>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db
      .selectFrom("video_segments")
      .selectAll()
      .where("streamId", "=", params.streamId);

    if (params.fromTime !== undefined) {
      query = query.where("startTime", ">=", params.fromTime);
    }
    if (params.toTime !== undefined) {
      query = query.where("endTime", "<=", params.toTime);
    }

    const items = await query
      .orderBy("startTime", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("video_segments")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("streamId", "=", params.streamId);

    if (params.fromTime !== undefined) {
      countQuery = countQuery.where("startTime", ">=", params.fromTime);
    }
    if (params.toTime !== undefined) {
      countQuery = countQuery.where("endTime", "<=", params.toTime);
    }

    const count = await countQuery.executeTakeFirst();

    return {
      items: items as VideoSegment[],
      totalCount: Number(count?.count ?? 0),
    };
  }

  async deleteSegment(id: VideoSegmentId): Promise<boolean> {
    await this.store.db
      .deleteFrom("video_segments")
      .where("id", "=", id)
      .execute();
    return true;
  }
}
