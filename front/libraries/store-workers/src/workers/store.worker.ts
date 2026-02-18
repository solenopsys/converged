import { deflateSync, inflateSync } from 'fflate';

const runtimeFlags = globalThis as { __USE_MOCK_STORE__?: boolean; __DEBUG_CHUNK_SIZES__?: boolean };

const useMockStore =
  runtimeFlags.__USE_MOCK_STORE__ === true ||
  (typeof process !== 'undefined' && process.env?.USE_MOCK_STORE === 'true');

const debugChunkSizes =
  runtimeFlags.__DEBUG_CHUNK_SIZES__ === true ||
  (typeof process !== 'undefined' && process.env?.DEBUG_CHUNK_SIZES === 'true');

const debugLog = (...args: unknown[]) => {
  if (!debugChunkSizes) return;
  console.log('[StoreWorker]', ...args);
};

const { createStoreService } = useMockStore
  ? await import('../api/store.service.mock')
  : await import('../api/store.service');

import {
  type DownloadWorkerIncomingMessage,
  type FileDownloadState,
  DownloadWorkerCommandType,
  DownloadWorkerEventType,
  type DownloadWorkerOutgoingMessage,
  type FileUploadState,
  type HashString,
  type UploadWorkerIncomingMessage,
  UploadWorkerCommandType,
  UploadWorkerEventType,
  type UploadWorkerOutgoingMessage,
} from '../types';

// --- Chunk Configuration ---
const MAX_CHUNK_SIZE = 512 * 1024; // 512KB
const MIN_CHUNK_SIZE = 4 * 1024;   // 4KB

// --- Combined State Management ---
const uploads = new Map<string, FileUploadState>();
const downloads = new Map<string, FileDownloadState>();

// --- Combined Message Type ---
type StoreWorkerIncomingMessage = UploadWorkerIncomingMessage | DownloadWorkerIncomingMessage;

// --- Single Message Handler ---
self.onmessage = (event: MessageEvent<StoreWorkerIncomingMessage>) => {
  const message = event.data;

  if (isUploadMessage(message)) {
    handleUploadMessage(message);
  } else if (isDownloadMessage(message)) {
    handleDownloadMessage(message);
  } else {
    console.warn('[StoreWorker] Unknown message', message);
  }
};

// --- Type Guards ---
function isUploadMessage(message: StoreWorkerIncomingMessage): message is UploadWorkerIncomingMessage {
  return Object.values(UploadWorkerCommandType).includes(message.type as any);
}

function isDownloadMessage(message: StoreWorkerIncomingMessage): message is DownloadWorkerIncomingMessage {
  return Object.values(DownloadWorkerCommandType).includes(message.type as any);
}

// --- Upload Worker Logic ---

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
      break;
    default:
      console.warn('[UploadWorker] Unknown message', message);
  }
}

const DEFAULT_MAX_BUFFERED_CHUNKS = 5;
const DEFAULT_RETRY = { attempts: 3, delayMs: 1000 } as const;

async function startUpload(message: Extract<UploadWorkerIncomingMessage, { type: UploadWorkerCommandType.UploadStart }>): Promise<void> {
  const { fileId, file } = message;

  if (uploads.has(fileId)) {
    cancelUpload(fileId);
  }

  const reader = file.stream().getReader();
  const store = createStoreService(message.store);

  const state: FileUploadState = {
    fileId,
    file,
    reader,
    store,
    buffer: new Uint8Array(0),
    bytesProcessed: 0,
    totalBytes: file.size,
    nextChunkNumber: 0,
    pendingUploads: new Map(),
    retry: message.retry ?? DEFAULT_RETRY,
    maxBufferedChunks: message.maxBufferedChunks ?? DEFAULT_MAX_BUFFERED_CHUNKS,
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

    // Читаем данные из файла
    const { value, done } = await state.reader.read();

    if (value) {
      state.bytesProcessed += value.length;
      state.buffer = concat(state.buffer, value);
      sendProgress(state);

      // Флашим чанки когда достаточно данных
      flushBuffer(state, false);
    }

    if (done) {
      state.streamEnded = true;
      // Флашим остаток
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

    // Вырезаем чанк из буфера
    const rawChunk = state.buffer.slice(0, chunkSize);
    state.buffer = state.buffer.slice(chunkSize);

    // Сжимаем чанк
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

  // Если есть MAX_CHUNK_SIZE или больше - берем MAX_CHUNK_SIZE
  if (bufferedBytes >= MAX_CHUNK_SIZE) {
    return MAX_CHUNK_SIZE;
  }

  // Если это последний чанк (allowRemainder) - берем все что есть
  if (allowRemainder) {
    return bufferedBytes;
  }

  // Иначе ждем пока накопится больше данных
  return 0;
}

function scheduleUpload(state: FileUploadState, chunkNumber: number, compressedData: Uint8Array, originalSize: number): void {
  // Валидация: compressed data не должен быть пустым
  if (compressedData.length === 0) {
    const error = new Error(`[Worker] Compressed chunk is empty: fileId=${state.fileId}, chunkNumber=${chunkNumber}, originalSize=${originalSize}`);
    console.error(error);
    emitUploadError(state, error, chunkNumber);
    return;
  }

  // Последовательная загрузка: ждем пока предыдущие чанки загрузятся
  const previousUploads = Array.from(state.pendingUploads.values()).map(entry => entry.promise);

  const uploadPromise = Promise.all(previousUploads)
    .then(() => uploadChunk(state, chunkNumber, compressedData, originalSize, 1));

  state.pendingUploads.set(chunkNumber, {
    chunkNumber,
    promise: uploadPromise,
  });

  uploadPromise
    .then(hash => sendChunkSaved(state, chunkNumber, compressedData.length, originalSize, hash))
    .catch(error => emitUploadError(state, error, chunkNumber))
    .finally(() => {
      state.pendingUploads.delete(chunkNumber);
      flushBuffer(state, state.streamEnded);
    });
}

async function uploadChunk(
  state: FileUploadState,
  chunkNumber: number,
  compressedData: Uint8Array,
  originalSize: number,
  attempt: number,
): Promise<HashString> {
  try {
    return await state.store.save(compressedData, originalSize, 'deflate');
  } catch (error) {
    if (attempt >= state.retry.attempts) {
      throw error;
    }
    await delay(state.retry.delayMs * attempt);
    return uploadChunk(state, chunkNumber, compressedData, originalSize, attempt + 1);
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

function sendChunkSaved(state: FileUploadState, chunkNumber: number, chunkSize: number, originalSize: number, hash: HashString): void {
  // Валидация: не отправляем пустые чанки
  if (chunkSize === 0) {
    const error = new Error(`[Worker] Attempted to save empty chunk: fileId=${state.fileId}, chunkNumber=${chunkNumber}`);
    console.error(error);
    emitUploadError(state, error, chunkNumber);
    return;
  }

  debugLog('chunk saved', {
    fileId: state.fileId,
    chunkNumber,
    chunkSize,
    originalSize,
    hash,
  });
  const message: UploadWorkerOutgoingMessage = {
    type: UploadWorkerEventType.ChunkReady,
    fileId: state.fileId,
    chunkNumber,
    chunkSize,
    hash,
  };

  self.postMessage(message);
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


// --- Download Worker Logic ---

function handleDownloadMessage(message: DownloadWorkerIncomingMessage) {
    switch (message.type) {
        case DownloadWorkerCommandType.DownloadStart:
            void startDownload(message);
            break;
        case DownloadWorkerCommandType.Abort:
            abortDownload(message.fileId);
            break;
        default:
            console.warn('[DownloadWorker] Unknown message', message);
    }
}

async function startDownload(message: Extract<DownloadWorkerIncomingMessage, { type: DownloadWorkerCommandType.DownloadStart }>): Promise<void> {
  const { fileId, chunks } = message;

  if (downloads.has(fileId)) {
    abortDownload(fileId);
  }

  debugLog('download start', { fileId, totalChunks: chunks.length });

  const store = createStoreService(message.store);
  const writer = createDestinationWriter(message.destination);

  const state: FileDownloadState = {
    fileId,
    store,
    writer,
    aborted: false,
  };

  downloads.set(fileId, state);

  const writeQueue = createWriteQueue(writer);

  try {
    for (let index = 0; index < chunks.length; index++) {
      if (state.aborted) break;

      const hash = chunks[index];
      debugLog('download chunk fetch:start', { fileId, chunkNumber: index, hash });

      // Получаем сжатые данные
      const compressedData = await store.get(hash);
      debugLog('download chunk fetch:done', { fileId, chunkNumber: index, compressedBytes: compressedData.byteLength });

      // Распаковываем каждый чанк отдельно
      const decompressedData = inflateSync(compressedData);
      debugLog('download chunk decompressed', {
        fileId,
        chunkNumber: index,
        compressedBytes: compressedData.byteLength,
        decompressedBytes: decompressedData.byteLength
      });

      void writeQueue(decompressedData);
      sendChunkProcessed(state, index);
    }

    if (!state.aborted) {
      await writeQueue();
      await writer.close();
      debugLog('download complete', { fileId });
      sendFileDownloaded(state);
    }
  } catch (error) {
    debugLog('download error', { fileId, error });
    emitDownloadError(state, error);
  } finally {
    downloads.delete(fileId);
  }
}

function abortDownload(fileId: string): void {
  const state = downloads.get(fileId);
  if (!state) return;
  state.aborted = true;
  state.writer.abort().catch(() => undefined);
  downloads.delete(fileId);
}

function sendChunkProcessed(state: FileDownloadState, chunkNumber: number): void {
  debugLog('download chunk processed', { fileId: state.fileId, chunkNumber });
  const message: DownloadWorkerOutgoingMessage = {
    type: DownloadWorkerEventType.Chunk,
    fileId: state.fileId,
    chunkNumber,
  };
  self.postMessage(message);
}

function sendFileDownloaded(state: FileDownloadState): void {
  debugLog('download file downloaded', { fileId: state.fileId });
  const message: DownloadWorkerOutgoingMessage = {
    type: DownloadWorkerEventType.FileDownloaded,
    fileId: state.fileId,
  };
  self.postMessage(message);
}

function emitDownloadError(state: FileDownloadState, error: unknown): void {
  debugLog('download emit error', { fileId: state.fileId, error });
  const message: DownloadWorkerOutgoingMessage = {
    type: DownloadWorkerEventType.Error,
    fileId: state.fileId,
    error: error instanceof Error ? error.message : String(error),
  };
  self.postMessage(message);
}

function createWriteQueue(writer: import('../types').DownloadWriter) {
  let tail = Promise.resolve();
  return (chunk?: Uint8Array) => {
    if (!chunk) {
      return tail;
    }
    tail = tail.then(() => writer.write(chunk));
    return tail;
  };
}

type DownloadDestination = WritableStream<Uint8Array> | MessagePort;

function createDestinationWriter(destination: DownloadDestination): import('../types').DownloadWriter {
  if (isWritableStream(destination)) {
    return destination.getWriter();
  }
  return createPortWriter(destination);
}

function isWritableStream(destination: DownloadDestination): destination is WritableStream<Uint8Array> {
  return typeof (destination as WritableStream<Uint8Array>).getWriter === 'function';
}

function createPortWriter(port: MessagePort): import('../types').DownloadWriter {
  let closed = false;
  return {
    write(chunk) {
      if (closed) {
        return Promise.reject(new Error('Cannot write to a closed port destination'));
      }
      const copy = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      debugLog('port writer write', { bytes: copy.byteLength });
      port.postMessage(copy, [copy]);
      return Promise.resolve();
    },
    close() {
      if (closed) return Promise.resolve();
      closed = true;
      debugLog('port writer close');
      port.postMessage({ type: 'close' });
      port.close();
      return Promise.resolve();
    },
    abort(reason) {
      if (closed) return Promise.resolve();
      closed = true;
      debugLog('port writer abort', { reason });
      port.postMessage({
        type: 'abort',
        error: reason instanceof Error ? reason.message : reason ? String(reason) : undefined,
      });
      port.close();
      return Promise.resolve();
    },
  };
}
