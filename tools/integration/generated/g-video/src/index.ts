// Auto-generated package
import { createHttpClient } from "nrpc";

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

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export type VideoThumbSaveInput = {
  streamId: VideoStreamId;
  data: Uint8Array;
  ext?: string;
};

export const metadata = {
  "interfaceName": "VideoService",
  "serviceName": "video",
  "filePath": "../types/video.ts",
  "methods": [
    {
      "name": "createCamera",
      "parameters": [
        {
          "name": "input",
          "type": "CameraInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getCamera",
      "parameters": [
        {
          "name": "id",
          "type": "CameraId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listCameras",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteCamera",
      "parameters": [
        {
          "name": "id",
          "type": "CameraId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createStream",
      "parameters": [
        {
          "name": "input",
          "type": "VideoStreamInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getStream",
      "parameters": [
        {
          "name": "id",
          "type": "VideoStreamId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listStreams",
      "parameters": [
        {
          "name": "cameraId",
          "type": "CameraId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteStream",
      "parameters": [
        {
          "name": "id",
          "type": "VideoStreamId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveSegment",
      "parameters": [
        {
          "name": "input",
          "type": "VideoSegmentInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getSegment",
      "parameters": [
        {
          "name": "id",
          "type": "VideoSegmentId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listSegments",
      "parameters": [
        {
          "name": "params",
          "type": "VideoSegmentListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteSegment",
      "parameters": [
        {
          "name": "id",
          "type": "VideoSegmentId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveThumb",
      "parameters": [
        {
          "name": "input",
          "type": "VideoThumbSaveInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getThumb",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteThumb",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "CameraId",
      "definition": "string"
    },
    {
      "name": "VideoStreamId",
      "definition": "string"
    },
    {
      "name": "VideoSegmentId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "Camera",
      "definition": "{\n  id: CameraId;\n  name: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "CameraInput",
      "definition": "{\n  name: string;\n}"
    },
    {
      "name": "VideoStream",
      "definition": "{\n  id: VideoStreamId;\n  cameraId: CameraId;\n  name: string;\n  resolution: string;\n  fps: number;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "VideoStreamInput",
      "definition": "{\n  cameraId: CameraId;\n  name: string;\n  resolution: string;\n  fps: number;\n}"
    },
    {
      "name": "VideoSegment",
      "definition": "{\n  id: VideoSegmentId;\n  streamId: VideoStreamId;\n  startTime: number;\n  endTime: number;\n  hash: string;\n  thumbPath?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "VideoSegmentInput",
      "definition": "{\n  streamId: VideoStreamId;\n  startTime: number;\n  endTime: number;\n  hash: string;\n  thumbPath?: string;\n}"
    },
    {
      "name": "VideoSegmentListParams",
      "definition": "{\n  streamId: VideoStreamId;\n  offset: number;\n  limit: number;\n  fromTime?: number;\n  toTime?: number;\n}"
    },
    {
      "name": "PaginationParams",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "VideoThumbSaveInput",
      "definition": "{\n  streamId: VideoStreamId;\n  data: Uint8Array;\n  ext?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface VideoService {
  createCamera(input: CameraInput): Promise<any>;
  getCamera(id: CameraId): Promise<any>;
  listCameras(params: PaginationParams): Promise<any>;
  deleteCamera(id: CameraId): Promise<any>;
  createStream(input: VideoStreamInput): Promise<any>;
  getStream(id: VideoStreamId): Promise<any>;
  listStreams(cameraId: CameraId, params: PaginationParams): Promise<any>;
  deleteStream(id: VideoStreamId): Promise<any>;
  saveSegment(input: VideoSegmentInput): Promise<any>;
  getSegment(id: VideoSegmentId): Promise<any>;
  listSegments(params: VideoSegmentListParams): Promise<any>;
  deleteSegment(id: VideoSegmentId): Promise<any>;
  saveThumb(input: VideoThumbSaveInput): Promise<any>;
  getThumb(path: string): Promise<any>;
  deleteThumb(path: string): Promise<any>;
}

// Client interface
export interface VideoServiceClient {
  createCamera(input: CameraInput): Promise<any>;
  getCamera(id: CameraId): Promise<any>;
  listCameras(params: PaginationParams): Promise<any>;
  deleteCamera(id: CameraId): Promise<any>;
  createStream(input: VideoStreamInput): Promise<any>;
  getStream(id: VideoStreamId): Promise<any>;
  listStreams(cameraId: CameraId, params: PaginationParams): Promise<any>;
  deleteStream(id: VideoStreamId): Promise<any>;
  saveSegment(input: VideoSegmentInput): Promise<any>;
  getSegment(id: VideoSegmentId): Promise<any>;
  listSegments(params: VideoSegmentListParams): Promise<any>;
  deleteSegment(id: VideoSegmentId): Promise<any>;
  saveThumb(input: VideoThumbSaveInput): Promise<any>;
  getThumb(path: string): Promise<any>;
  deleteThumb(path: string): Promise<any>;
}

// Factory function
export function createVideoServiceClient(
  config?: { baseUrl?: string },
): VideoServiceClient {
  return createHttpClient<VideoServiceClient>(metadata, config);
}

// Ready-to-use client
export const videoClient = createVideoServiceClient();
