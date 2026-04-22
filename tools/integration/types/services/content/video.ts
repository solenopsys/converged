export type CameraId = string;
export type VideoStreamId = string;
export type VideoSegmentId = string;
export type ISODateString = string;

export type Camera = {
  id: CameraId;
  name: string;
  createdAt: ISODateString;
};

export type CameraInput = {
  name: string;
};

export type VideoStream = {
  id: VideoStreamId;
  cameraId: CameraId;
  name: string;
  resolution: string;
  fps: number;
  createdAt: ISODateString;
};

export type VideoStreamInput = {
  cameraId: CameraId;
  name: string;
  resolution: string;
  fps: number;
};

export type VideoSegment = {
  id: VideoSegmentId;
  streamId: VideoStreamId;
  startTime: number;
  endTime: number;
  hash: string;
  thumbPath?: string;
  createdAt: ISODateString;
};

export type VideoSegmentInput = {
  streamId: VideoStreamId;
  startTime: number;
  endTime: number;
  hash: string;
  thumbPath?: string;
};

export type VideoSegmentListParams = {
  streamId: VideoStreamId;
  offset: number;
  limit: number;
  fromTime?: number;
  toTime?: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export type VideoThumbSaveInput = {
  streamId: VideoStreamId;
  data: Uint8Array;
  ext?: string;
};

export interface VideoService {
  createCamera(input: CameraInput): Promise<CameraId>;
  getCamera(id: CameraId): Promise<Camera | null>;
  listCameras(params: PaginationParams): Promise<PaginatedResult<Camera>>;
  deleteCamera(id: CameraId): Promise<boolean>;

  createStream(input: VideoStreamInput): Promise<VideoStreamId>;
  getStream(id: VideoStreamId): Promise<VideoStream | null>;
  listStreams(
    cameraId: CameraId,
    params: PaginationParams,
  ): Promise<PaginatedResult<VideoStream>>;
  deleteStream(id: VideoStreamId): Promise<boolean>;

  saveSegment(input: VideoSegmentInput): Promise<VideoSegmentId>;
  getSegment(id: VideoSegmentId): Promise<VideoSegment | null>;
  listSegments(
    params: VideoSegmentListParams,
  ): Promise<PaginatedResult<VideoSegment>>;
  deleteSegment(id: VideoSegmentId): Promise<boolean>;

  saveThumb(input: VideoThumbSaveInput): Promise<string>;
  getThumb(path: string): Promise<Uint8Array | undefined>;
  deleteThumb(path: string): Promise<boolean>;
}
