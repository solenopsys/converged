import type { UUID, HashString } from '../../../../../types/files';
import type { CreateStoreServiceOptions, StoreService } from './api/store.service';

export const BLOCK_SIZE_BYTES = 512 * 1024;
export const MIN_CHUNK_SIZE_BYTES = 4 * 1024;
export const COMPRESSION_LEVEL = 3;

export type CompressionType = 'none' | 'deflate' | 'gzip' | 'brotli';

export type RetryConfig = {
  attempts: number;
  delayMs: number;
};

export enum UploadWorkerCommandType {
  UploadStart = 'UPLOAD_START',
  ChunkConsumed = 'CHUNK_CONSUMED',
  Pause = 'UPLOAD_PAUSE',
  Resume = 'UPLOAD_RESUME',
  Cancel = 'UPLOAD_CANCEL',
}

export type UploadWorkerIncomingMessage =
  | {
      type: UploadWorkerCommandType.UploadStart;
      fileId: UUID;
      file: File;
      maxBufferedChunks?: number;
      retry?: RetryConfig;
      store?: CreateStoreServiceOptions;
    }
  | {
      type: UploadWorkerCommandType.ChunkConsumed;
      fileId: UUID;
      chunkNumber: number;
    }
  | {
      type: UploadWorkerCommandType.Pause;
      fileId: UUID;
    }
  | {
      type: UploadWorkerCommandType.Resume;
      fileId: UUID;
    }
  | {
      type: UploadWorkerCommandType.Cancel;
      fileId: UUID;
    };

export enum UploadWorkerEventType {
  ChunkReady = 'CHUNK_READY',
  Progress = 'UPLOAD_PROGRESS',
  Error = 'UPLOAD_ERROR',
  FileUploaded = 'FILE_UPLOADED',
}

export type UploadWorkerOutgoingMessage =
  | {
      type: UploadWorkerEventType.ChunkReady;
      fileId: UUID;
      chunkNumber: number;
      hash: HashString;
      chunkSize: number;
    }
  | {
      type: UploadWorkerEventType.Progress;
      fileId: UUID;
      bytesProcessed: number;
      totalBytes: number;
    }
  | {
      type: UploadWorkerEventType.FileUploaded;
      fileId: UUID;
      totalChunks: number;
    }
  | {
      type: UploadWorkerEventType.Error;
      fileId: UUID;
      chunkNumber?: number;
      attempt?: number;
      error: string;
    };

export enum DownloadWorkerCommandType {
  DownloadStart = 'DOWNLOAD_START',
  Abort = 'DOWNLOAD_ABORT',
}

export type DownloadWorkerIncomingMessage =
  | {
      type: DownloadWorkerCommandType.DownloadStart;
      fileId: UUID;
      destination: WritableStream<Uint8Array> | MessagePort;
      chunks: readonly HashString[];
      store?: CreateStoreServiceOptions;
    }
  | {
      type: DownloadWorkerCommandType.Abort;
      fileId: UUID;
    };

export enum DownloadWorkerEventType {
  Chunk = 'DOWNLOAD_CHUNK',
  FileDownloaded = 'FILE_DOWNLOADED',
  Error = 'DOWNLOAD_ERROR',
}

export type DownloadWorkerOutgoingMessage =
  | {
      type: DownloadWorkerEventType.Chunk;
      fileId: UUID;
      chunkNumber: number;
    }
  | {
      type: DownloadWorkerEventType.FileDownloaded;
      fileId: UUID;
    }
  | {
      type: DownloadWorkerEventType.Error;
      fileId: UUID;
      chunkNumber?: number;
      error: string;
    };

export type ChunkUploadTask = {
  chunkNumber: number;
  promise: Promise<HashString>;
};

export type FileUploadState = {
  fileId: UUID;
  file: File;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  store: StoreService;
  buffer: Uint8Array;
  bytesProcessed: number;
  totalBytes: number;
  nextChunkNumber: number;
  pendingUploads: Map<number, ChunkUploadTask>;
  retry: RetryConfig;
  maxBufferedChunks: number;
  paused: boolean;
  cancelled: boolean;
  streamEnded: boolean;
};

export type { UUID, HashString };

export type DownloadWriter = {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
};

export type FileDownloadState = {
  fileId: UUID;
  store: StoreService;
  writer: DownloadWriter;
  aborted: boolean;
};
