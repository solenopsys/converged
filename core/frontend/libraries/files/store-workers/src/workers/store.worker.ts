import { deflateSync } from 'fflate';

const runtimeFlags = globalThis as { __USE_MOCK_STORE__?: boolean; __DEBUG_CHUNK_SIZES__?: boolean };

const debugChunkSizes =
  runtimeFlags.__DEBUG_CHUNK_SIZES__ === true ||
  (typeof process !== 'undefined' && process.env?.DEBUG_CHUNK_SIZES === 'true');

const debugLog = (...args: unknown[]) => {
  if (!debugChunkSizes) return;
  console.log('[StoreWorker]', ...args);
};

import {
  type FileUploadState,
  type UploadWorkerIncomingMessage,
  UploadWorkerCommandType,
  UploadWorkerEventType,
  type UploadWorkerOutgoingMessage,
} from '../types';

const MAX_CHUNK_SIZE = 512 * 1024; // 512KB
const uploads = new Map<string, FileUploadState>();

self.onmessage = (event: MessageEvent<UploadWorkerIncomingMessage>) => {
  const message = event.data;

  if (isUploadMessage(message)) {
    handleUploadMessage(message);
  } else {
    console.warn('[StoreWorker] Unknown message', message);
  }
};

function isUploadMessage(message: unknown): message is UploadWorkerIncomingMessage {
  if (!message || typeof message !== 'object' || !('type' in message)) return false;
  return Object.values(UploadWorkerCommandType).includes(message.type as any);
}


function handleUploadMessage(message: UploadWorkerIncomingMessage) {
  switch (message.type) {
    case UploadWorkerCommandType.UploadStart:
      void startUpload(message);
      break;
    case UploadWorkerCommandType.Cancel:
      cancelUpload(message.fileId);
      break;
    case UploadWorkerCommandType.Pause:
      pauseUpload(message.fileId);
      break;
    case UploadWorkerCommandType.Resume:
      resumeUpload(message.fileId);
      break;
    case UploadWorkerCommandType.ChunkConsumed:
      acknowledgeChunk(message.fileId, message.chunkNumber);
      break;
    default:
      console.warn('[UploadWorker] Unknown message', message);
  }
}

const DEFAULT_MAX_BUFFERED_CHUNKS = 5;
async function startUpload(message: Extract<UploadWorkerIncomingMessage, { type: UploadWorkerCommandType.UploadStart }>): Promise<void> {
  const { fileId, file } = message;

  if (uploads.has(fileId)) {
    cancelUpload(fileId);
  }

  const reader = file.stream().getReader();
  const state: FileUploadState = {
    fileId,
    file,
    reader,
    buffer: new Uint8Array(0),
    bytesProcessed: 0,
    totalBytes: file.size,
    nextChunkNumber: 0,
    pendingUploads: new Map(),
    maxBufferedChunks: message.maxBufferedChunks ?? DEFAULT_MAX_BUFFERED_CHUNKS,
    cacheBlobUrl: message.cacheBlobUrl ?? '/cache/blob',
    paused: false,
    cancelled: false,
    streamEnded: false,
  };

  uploads.set(fileId, state);

  try {
    await pumpFile(state);
  } catch (error) {
    emitUploadError(state, error);
  }
}

async function pumpFile(state: FileUploadState): Promise<void> {
  while (!state.cancelled) {
    if (state.paused) {
      await delay(100);
      continue;
    }

    const { value, done } = await state.reader.read();

    if (value) {
      state.bytesProcessed += value.length;
      state.buffer = concat(state.buffer, value);
      sendProgress(state);

      flushBuffer(state, false);
    }

    if (done) {
      state.streamEnded = true;
      flushBuffer(state, true);
      await waitForPending(state);
      emitFileUploaded(state);
      break;
    }
  }
}

function flushBuffer(state: FileUploadState, allowRemainder: boolean): void {
  while (state.buffer.length > 0 && state.pendingUploads.size < state.maxBufferedChunks) {
    const chunkSize = calculateChunkSize(state.buffer.length, allowRemainder);
    if (chunkSize === 0) break;

    const rawChunk = state.buffer.slice(0, chunkSize);
    state.buffer = state.buffer.slice(chunkSize);

    const compressedChunk = deflateSync(rawChunk, { level: 3 });

    const chunkNumber = state.nextChunkNumber++;
    debugLog('chunk created', {
      chunkNumber,
      originalSize: rawChunk.length,
      compressedSize: compressedChunk.length,
      ratio: (compressedChunk.length / rawChunk.length * 100).toFixed(1) + '%'
    });

    scheduleUpload(state, chunkNumber, compressedChunk, rawChunk.length);
  }
}

function calculateChunkSize(bufferedBytes: number, allowRemainder: boolean): number {
  if (bufferedBytes <= 0) return 0;

  if (bufferedBytes >= MAX_CHUNK_SIZE) {
    return MAX_CHUNK_SIZE;
  }

  if (allowRemainder) {
    return bufferedBytes;
  }

  return 0;
}

function scheduleUpload(state: FileUploadState, chunkNumber: number, compressedData: Uint8Array, originalSize: number): void {
  if (compressedData.length === 0) {
    const error = new Error(`[Worker] Compressed chunk is empty: fileId=${state.fileId}, chunkNumber=${chunkNumber}, originalSize=${originalSize}`);
    console.error(error);
    emitUploadError(state, error, chunkNumber);
    return;
  }

  let resolve!: () => void;
  const promise = new Promise<void>((onResolve) => {
    resolve = onResolve;
  });
  state.pendingUploads.set(chunkNumber, {
    chunkNumber,
    promise,
    resolve,
  });

  void stageChunk(state, chunkNumber, compressedData, originalSize);
}

async function stageChunk(
  state: FileUploadState,
  chunkNumber: number,
  compressedData: Uint8Array,
  originalSize: number,
): Promise<void> {
  try {
    const response = await fetch(state.cacheBlobUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob([compressedData as BlobPart]),
    });
    if (!response.ok) {
      throw new Error(`Cache blob upload failed: HTTP ${response.status}`);
    }

    const value = await response.json() as { cacheKey?: unknown; sizeBytes?: unknown };
    if (typeof value.cacheKey !== 'string' || value.cacheKey.length === 0) {
      throw new Error('Cache blob upload returned an invalid cache reference');
    }

    const message: UploadWorkerOutgoingMessage = {
      type: UploadWorkerEventType.ChunkPrepared,
      fileId: state.fileId,
      chunkNumber,
      dataRef: {
        cacheKey: value.cacheKey,
        sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : compressedData.byteLength,
      },
      originalSize,
      compression: 'deflate',
    };
    self.postMessage(message);
  } catch (error) {
    state.cancelled = true;
    const task = state.pendingUploads.get(chunkNumber);
    state.pendingUploads.delete(chunkNumber);
    task?.resolve();
    emitUploadError(state, error, chunkNumber);
  }
}

async function waitForPending(state: FileUploadState): Promise<void> {
  while (state.pendingUploads.size > 0 || state.buffer.length > 0) {
    const pending = Array.from(state.pendingUploads.values()).map(entry => entry.promise);
    if (pending.length === 0) {
      flushBuffer(state, state.streamEnded);
      continue;
    }
    await Promise.all(pending);
  }
}

function acknowledgeChunk(fileId: string, chunkNumber: number): void {
  const state = uploads.get(fileId);
  const task = state?.pendingUploads.get(chunkNumber);
  if (!state || !task) return;

  debugLog('staged chunk registered through core', { fileId, chunkNumber });
  state.pendingUploads.delete(chunkNumber);
  task.resolve();
  flushBuffer(state, state.streamEnded);
}

function sendProgress(state: FileUploadState): void {
  const message: UploadWorkerOutgoingMessage = {
    type: UploadWorkerEventType.Progress,
    fileId: state.fileId,
    bytesProcessed: state.bytesProcessed,
    totalBytes: state.totalBytes,
  };
  self.postMessage(message);
}

function emitFileUploaded(state: FileUploadState): void {
  const message: UploadWorkerOutgoingMessage = {
    type: UploadWorkerEventType.FileUploaded,
    fileId: state.fileId,
    totalChunks: state.nextChunkNumber,
  };
  self.postMessage(message);
  uploads.delete(state.fileId);
}

function emitUploadError(state: FileUploadState, error: unknown, chunkNumber?: number): void {
  const message: UploadWorkerOutgoingMessage = {
    type: UploadWorkerEventType.Error,
    fileId: state.fileId,
    chunkNumber,
    error: error instanceof Error ? error.message : String(error),
  };
  self.postMessage(message);
}

function cancelUpload(fileId: string): void {
  const state = uploads.get(fileId);
  if (!state) return;
  state.cancelled = true;
  state.reader.cancel().catch(() => undefined);
  uploads.delete(fileId);
}

function pauseUpload(fileId: string): void {
  const state = uploads.get(fileId);
  if (state) {
    state.paused = true;
  }
}

function resumeUpload(fileId: string): void {
  const state = uploads.get(fileId);
  if (state) {
    state.paused = false;
  }
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length === 0) return right;
  if (right.length === 0) return left;
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left);
  merged.set(right, left.length);
  return merged;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
