// segments/workers/worker-helpers.ts
// Опциональный helper для управления воркерами

import type { UUID } from '../../../../../../types/files';
import type {
  CompressionWorkerIncomingMessage,
  DecompressionWorkerIncomingMessage,
} from './types';
import { createWorker as createCompressionWorkerInstance } from './compression.worker.ts';
import { createWorker as createDecompressionWorkerInstance } from './decompression.worker.ts';

/**
 * Wrapper для Compression Worker с удобными методами
 */
export class CompressionWorkerManager {
  private worker: Worker;

  constructor() {
    this.worker = createCompressionWorkerInstance();
  }

  addFile(fileId: UUID, file: File, maxBufferedChunks: number = 5) {
    const message: CompressionWorkerIncomingMessage = {
      type: 'ADD_FILE',
      fileId,
      file,
      maxBufferedChunks,
    };
    this.worker.postMessage(message);
  }

  chunkConsumed(fileId: UUID) {
    const message: CompressionWorkerIncomingMessage = {
      type: 'CHUNK_CONSUMED',
      fileId,
    };
    this.worker.postMessage(message);
  }

  pauseFile(fileId: UUID) {
    const message: CompressionWorkerIncomingMessage = {
      type: 'PAUSE_FILE',
      fileId,
    };
    this.worker.postMessage(message);
  }

  resumeFile(fileId: UUID) {
    const message: CompressionWorkerIncomingMessage = {
      type: 'RESUME_FILE',
      fileId,
    };
    this.worker.postMessage(message);
  }

  cancelFile(fileId: UUID) {
    const message: CompressionWorkerIncomingMessage = {
      type: 'CANCEL_FILE',
      fileId,
    };
    this.worker.postMessage(message);
  }

  onMessage(callback: (event: MessageEvent) => void) {
    this.worker.onmessage = callback;
  }

  terminate() {
    this.worker.terminate();
  }

  getWorker(): Worker {
    return this.worker;
  }
}

/**
 * Wrapper для Decompression Worker с удобными методами
 */
export class DecompressionWorkerManager {
  private worker: Worker;

  constructor() {
    this.worker = createDecompressionWorkerInstance();
  }

  decompressChunk(
    fileId: UUID,
    chunkNumber: number,
    data: Uint8Array,
    isLastChunk: boolean
  ) {
    const message: DecompressionWorkerIncomingMessage = {
      type: 'DECOMPRESS_CHUNK',
      fileId,
      chunkNumber,
      data,
      isLastChunk,
    };
    // Transfer ownership для производительности
    this.worker.postMessage(message, [data.buffer]);
  }

  onMessage(callback: (event: MessageEvent) => void) {
    this.worker.onmessage = callback;
  }

  terminate() {
    this.worker.terminate();
  }

  getWorker(): Worker {
    return this.worker;
  }
}

/**
 * Singleton менеджер для всех workers приложения
 */
class WorkerPool {
  private static instance: WorkerPool;
  private compressionWorker: CompressionWorkerManager | null = null;
  private decompressionWorker: DecompressionWorkerManager | null = null;

  private constructor() {}

  static getInstance(): WorkerPool {
    if (!WorkerPool.instance) {
      WorkerPool.instance = new WorkerPool();
    }
    return WorkerPool.instance;
  }

  getCompressionWorker(): CompressionWorkerManager {
    if (!this.compressionWorker) {
      this.compressionWorker = new CompressionWorkerManager();
    }
    return this.compressionWorker;
  }

  getDecompressionWorker(): DecompressionWorkerManager {
    if (!this.decompressionWorker) {
      this.decompressionWorker = new DecompressionWorkerManager();
    }
    return this.decompressionWorker;
  }

  terminateAll() {
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
      this.compressionWorker = null;
    }
    if (this.decompressionWorker) {
      this.decompressionWorker.terminate();
      this.decompressionWorker = null;
    }
  }
}

export const workerPool = WorkerPool.getInstance();