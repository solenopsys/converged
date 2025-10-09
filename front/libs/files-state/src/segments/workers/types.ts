// segments/workers/types.ts
import { type UUID, type HashString } from "../../../../../../types/files";

// ==========================================
// COMPRESSION WORKER MESSAGES
// ==========================================

export type CompressionWorkerIncomingMessage =
  | {
      type: 'ADD_FILE';
      fileId: UUID;
      file: File;
      maxBufferedChunks: number;
    }
  | {
      type: 'CHUNK_CONSUMED';
      fileId: UUID;
    }
  | {
      type: 'PAUSE_FILE';
      fileId: UUID;
    }
  | {
      type: 'RESUME_FILE';
      fileId: UUID;
    }
  | {
      type: 'CANCEL_FILE';
      fileId: UUID;
    };

export type CompressionWorkerOutgoingMessage =
  | {
      type: 'CHUNK_READY';
      fileId: UUID;
      chunkNumber: number;
      data: Uint8Array;
      hash: HashString;
    }
  | {
      type: 'FILE_COMPLETE';
      fileId: UUID;
      totalChunks: number;
    }
  | {
      type: 'ERROR';
      fileId: UUID;
      error: string;
    }
  | {
      type: 'PROGRESS';
      fileId: UUID;
      bytesProcessed: number;
      totalBytes: number;
    };

// ==========================================
// DECOMPRESSION WORKER MESSAGES
// ==========================================

export type DecompressionWorkerIncomingMessage = {
  type: 'DECOMPRESS_CHUNK';
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
  isLastChunk: boolean;
};

export type DecompressionWorkerOutgoingMessage =
  | {
      type: 'CHUNK_DECOMPRESSED';
      fileId: UUID;
      chunkNumber: number;
      data: Uint8Array;
    }
  | {
      type: 'ERROR';
      fileId: UUID;
      chunkNumber: number;
      error: string;
    };