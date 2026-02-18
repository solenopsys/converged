import type {
  VideoService,
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
  VideoThumbSaveInput,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "video-ms";

export class VideoServiceImpl implements VideoService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async createCamera(input: CameraInput): Promise<CameraId> {
    await this.ready();
    return this.stores.metadata.createCamera(input);
  }

  async getCamera(id: CameraId): Promise<Camera | null> {
    await this.ready();
    return this.stores.metadata.getCamera(id);
  }

  async listCameras(
    params: PaginationParams,
  ): Promise<PaginatedResult<Camera>> {
    await this.ready();
    return this.stores.metadata.listCameras(params);
  }

  async deleteCamera(id: CameraId): Promise<boolean> {
    await this.ready();
    return this.stores.metadata.deleteCamera(id);
  }

  async createStream(input: VideoStreamInput): Promise<VideoStreamId> {
    await this.ready();
    return this.stores.metadata.createStream(input);
  }

  async getStream(id: VideoStreamId): Promise<VideoStream | null> {
    await this.ready();
    return this.stores.metadata.getStream(id);
  }

  async listStreams(
    cameraId: CameraId,
    params: PaginationParams,
  ): Promise<PaginatedResult<VideoStream>> {
    await this.ready();
    return this.stores.metadata.listStreams(cameraId, params);
  }

  async deleteStream(id: VideoStreamId): Promise<boolean> {
    await this.ready();
    return this.stores.metadata.deleteStream(id);
  }

  async saveSegment(input: VideoSegmentInput): Promise<VideoSegmentId> {
    await this.ready();
    return this.stores.metadata.saveSegment(input);
  }

  async getSegment(id: VideoSegmentId): Promise<VideoSegment | null> {
    await this.ready();
    return this.stores.metadata.getSegment(id);
  }

  async listSegments(
    params: VideoSegmentListParams,
  ): Promise<PaginatedResult<VideoSegment>> {
    await this.ready();
    return this.stores.metadata.listSegments(params);
  }

  async deleteSegment(id: VideoSegmentId): Promise<boolean> {
    await this.ready();
    return this.stores.metadata.deleteSegment(id);
  }

  async saveThumb(input: VideoThumbSaveInput): Promise<string> {
    await this.ready();
    return this.stores.thumbsService.save(
      input.streamId,
      input.data,
      input.ext ?? "jpg",
    );
  }

  async getThumb(path: string): Promise<Uint8Array | undefined> {
    await this.ready();
    return this.stores.thumbsService.get(path);
  }

  async deleteThumb(path: string): Promise<boolean> {
    await this.ready();
    return this.stores.thumbsService.delete(path);
  }
}

export default VideoServiceImpl;
