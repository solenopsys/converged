type UUID = string;

export const BLOCK_SIZE_BYTES = 512 * 1024;
export const MIN_CHUNK_SIZE_BYTES = 4 * 1024;
export const COMPRESSION_LEVEL = 3;

export type CompressionType = "none" | "deflate" | "gzip" | "brotli";

export type CacheRef = {
	cacheKey: string;
	sizeBytes?: number;
};

export type RetryConfig = {
	attempts: number;
	delayMs: number;
};

export enum UploadWorkerCommandType {
	UploadStart = "UPLOAD_START",
	ChunkConsumed = "CHUNK_CONSUMED",
	Pause = "UPLOAD_PAUSE",
	Resume = "UPLOAD_RESUME",
	Cancel = "UPLOAD_CANCEL",
}

export type UploadWorkerIncomingMessage =
	| {
			type: UploadWorkerCommandType.UploadStart;
			fileId: UUID;
			file: File;
			maxBufferedChunks?: number;
			cacheBlobUrl?: string;
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
	ChunkPrepared = "CHUNK_PREPARED",
	Progress = "UPLOAD_PROGRESS",
	Error = "UPLOAD_ERROR",
	FileUploaded = "FILE_UPLOADED",
}

export type UploadWorkerOutgoingMessage =
	| {
			type: UploadWorkerEventType.ChunkPrepared;
			fileId: UUID;
			chunkNumber: number;
			dataRef: CacheRef;
			originalSize: number;
			compression: "deflate";
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

export type ChunkUploadTask = {
	chunkNumber: number;
	promise: Promise<void>;
	resolve(): void;
};

export type FileUploadState = {
	fileId: UUID;
	file: File;
	reader: ReadableStreamDefaultReader<Uint8Array>;
	buffer: Uint8Array;
	bytesProcessed: number;
	totalBytes: number;
	nextChunkNumber: number;
	pendingUploads: Map<number, ChunkUploadTask>;
	maxBufferedChunks: number;
	cacheBlobUrl: string;
	paused: boolean;
	cancelled: boolean;
	streamEnded: boolean;
};

export type { UUID };
