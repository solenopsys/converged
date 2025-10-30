// segments/streaming/index.ts - REFACTORED
import { fileTransferDomain } from '../domain';
import { $fileMetadataCache, $fileChunkHashes } from './files';
import { type UUID } from "../../../../../types/files";
import { sample, combine } from 'effector';
import type {
  CompressionWorkerIncomingMessage,
  CompressionWorkerOutgoingMessage,
  DecompressionWorkerIncomingMessage,
  DecompressionWorkerOutgoingMessage,
} from './workers/types';

// ==========================================
// EVENTS (остаются как API для остальной системы)
// ==========================================

export const compressionStarted = fileTransferDomain.createEvent<{
  fileId: UUID;
  file: File;
}>('COMPRESSION_STARTED');

export const chunkPrepared = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>('CHUNK_PREPARED');

export const compressionCompleted = fileTransferDomain.createEvent<{
  fileId: UUID;
  totalChunks: number;
}>('COMPRESSION_COMPLETED');

export const compressionFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  error: string;
}>('COMPRESSION_FAILED');

export const decompressionStarted = fileTransferDomain.createEvent<{
  fileId: UUID;
}>('DECOMPRESSION_STARTED');

export const decompressionStateInitialized = fileTransferDomain.createEvent<{
  fileId: UUID;
  totalChunks: number;
}>('DECOMPRESSION_STATE_INITIALIZED');

export const decompressionFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  error: string;
}>('DECOMPRESSION_FAILED');

export const decompressionChunkRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>('DECOMPRESSION_CHUNK_REQUESTED');

export const decompressionDataReceived = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>('DECOMPRESSION_DATA_RECEIVED');

export const decompressionChunkProcessed = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  decompressed: Uint8Array;
}>('DECOMPRESSION_CHUNK_PROCESSED');

export const decompressionCompleted = fileTransferDomain.createEvent<UUID>('DECOMPRESSION_COMPLETED');

export const chunkConsumed = fileTransferDomain.createEvent<UUID>('CHUNK_CONSUMED');

// ==========================================
// WORKERS INITIALIZATION
// ==========================================

console.log('[Streaming] Initializing workers...');

// Worker будет создан из blob (inline bundle)
import { createWorker as createCompressionWorker } from './workers/compression.worker.ts';
import { createWorker as createDecompressionWorker } from './workers/decompression.worker.ts';

const compressionWorker = createCompressionWorker();
const decompressionWorker = createDecompressionWorker();

console.log('[Streaming] Workers initialized');

// ==========================================
// WORKER MESSAGE HANDLERS
// ==========================================

// Compression Worker messages
compressionWorker.onmessage = (event: MessageEvent<CompressionWorkerOutgoingMessage>) => {
  const message = event.data;

  console.log('[Streaming] Compression worker message:', message.type, message);

  switch (message.type) {
    case 'CHUNK_READY':
      console.log('[Streaming] Triggering chunkPrepared event:', {
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        dataSize: message.data.length
      });
      chunkPrepared({
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        data: message.data,
      });
      break;

    case 'FILE_COMPLETE':
      console.log('[Streaming] Triggering compressionCompleted event:', {
        fileId: message.fileId,
        totalChunks: message.totalChunks
      });
      compressionCompleted({
        fileId: message.fileId,
        totalChunks: message.totalChunks,
      });
      break;

    case 'ERROR':
      console.error('[Streaming] Compression error:', message);
      compressionFailed({
        fileId: message.fileId,
        error: message.error,
      });
      break;

    case 'PROGRESS':
      console.log('[Streaming] Compression progress:', {
        fileId: message.fileId,
        bytesProcessed: message.bytesProcessed,
        totalBytes: message.totalBytes,
        percentage: ((message.bytesProcessed / message.totalBytes) * 100).toFixed(2) + '%'
      });
      break;
  }
};

compressionWorker.onerror = (error) => {
  console.error('[Streaming] Compression worker error:', error);
};

// Decompression Worker messages
decompressionWorker.onmessage = (event: MessageEvent<DecompressionWorkerOutgoingMessage>) => {
  const message = event.data;

  console.log('[Streaming] Decompression worker message:', message.type, message);

  switch (message.type) {
    case 'CHUNK_DECOMPRESSED':
      console.log('[Streaming] Triggering decompressionChunkProcessed event:', {
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        dataSize: message.data.length
      });
      decompressionChunkProcessed({
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        decompressed: message.data,
      });
      break;

    case 'ERROR':
      console.error('[Streaming] Decompression error:', message);
      decompressionFailed({
        fileId: message.fileId,
        error: message.error,
      });
      break;
  }
};

decompressionWorker.onerror = (error) => {
  console.error('[Streaming] Decompression worker error:', error);
};

// ==========================================
// STORES
// ==========================================

export const $decompressionState = fileTransferDomain.createStore<Map<UUID, {
  currentChunkNumber: number;
  totalChunks: number;
}>>(new Map(), { name: 'DECOMPRESSION_STATE' });

// ==========================================
// COMPRESSION LOGIC (через Worker)
// ==========================================

const MAX_BUFFERED_CHUNKS = 5;

sample({
  clock: compressionStarted,
  fn: ({ fileId, file }) => {
    console.log('[Streaming] compressionStarted event received:', {
      fileId,
      fileName: file.name,
      fileSize: file.size
    });

    const message: CompressionWorkerIncomingMessage = {
      type: 'ADD_FILE',
      fileId,
      file,
      maxBufferedChunks: MAX_BUFFERED_CHUNKS,
    };

    console.log('[Streaming] Sending ADD_FILE message to worker:', message);
    compressionWorker.postMessage(message);
  },
});

// Backpressure: сообщаем worker когда chunk освободился
sample({
  clock: chunkConsumed,
  fn: (fileId) => {
    console.log('[Streaming] chunkConsumed event received:', fileId);

    const message: CompressionWorkerIncomingMessage = {
      type: 'CHUNK_CONSUMED',
      fileId,
    };

    console.log('[Streaming] Sending CHUNK_CONSUMED message to worker:', message);
    compressionWorker.postMessage(message);
  },
});

// ==========================================
// DECOMPRESSION LOGIC (через Worker)
// ==========================================

// Инициализация состояния декомпрессии
sample({
  clock: decompressionStarted,
  source: combine({
    metadata: $fileMetadataCache,
    hashes: $fileChunkHashes,
  }),
  filter: ({ metadata }, { fileId }) => metadata.has(fileId),
  fn: ({ metadata, hashes }, { fileId }) => {
    const metadataEntry = metadata.get(fileId)!;
    const chunkHashes = hashes.get(fileId);
    const totalChunks =
      chunkHashes?.size ??
      metadataEntry.chunksCount ??
      0;
    return { fileId, totalChunks };
  },
  target: decompressionStateInitialized
});

// Обработка ошибки отсутствия метаданных
sample({
  clock: decompressionStarted,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => !cache.has(fileId),
  fn: (cache, { fileId }) => ({
    fileId,
    error: `File metadata not found for ${fileId}`
  }),
  target: decompressionFailed
});

// Установка состояния декомпрессии
$decompressionState.on(decompressionStateInitialized, (state, { fileId, totalChunks }) => {
  const newMap = new Map(state);
  newMap.set(fileId, { 
    currentChunkNumber: 0, 
    totalChunks 
  });
  return newMap;
});

// Начинаем с первого чанка
sample({
  clock: decompressionStateInitialized,
  fn: ({ fileId }) => ({
    fileId,
    chunkNumber: 0
  }),
  target: decompressionChunkRequested
});

// Отправляем chunk в worker для декомпрессии
sample({
  clock: decompressionDataReceived,
  source: $decompressionState,
  fn: (state, { fileId, chunkNumber, data }) => {
    console.log('[Streaming] decompressionDataReceived event:', {
      fileId,
      chunkNumber,
      dataSize: data.length
    });

    const decompState = state.get(fileId);
    if (!decompState) {
      throw new Error(`Decompression state not found for ${fileId}`);
    }
    const isLast = chunkNumber === decompState.totalChunks - 1;
    
    console.log('[Streaming] Sending DECOMPRESS_CHUNK to worker:', {
      fileId,
      chunkNumber,
      isLastChunk: isLast
    });

    const message: DecompressionWorkerIncomingMessage = {
      type: 'DECOMPRESS_CHUNK',
      fileId,
      chunkNumber,
      data,
      isLastChunk: isLast,
    };
    
    decompressionWorker.postMessage(message, [data.buffer]);
  },
});

// Запрос следующего chunk
sample({
  clock: decompressionChunkProcessed,
  source: $decompressionState,
  filter: (state, { fileId, chunkNumber }) => {
    const decompState = state.get(fileId);
    return decompState !== undefined && chunkNumber < decompState.totalChunks - 1;
  },
  fn: (state, { fileId, chunkNumber }) => ({
    fileId,
    chunkNumber: chunkNumber + 1
  }),
  target: decompressionChunkRequested
});

sample({
  clock: decompressionChunkProcessed,
  source: $decompressionState,
  filter: (state, { fileId, chunkNumber }) => {
    const decompState = state.get(fileId);
    return decompState !== undefined && chunkNumber >= decompState.totalChunks - 1;
  },
  fn: (state, { fileId }) => fileId,
  target: decompressionCompleted
});

// ==========================================
// CLEANUP
// ==========================================

export function terminateWorkers() {
  console.log('[Streaming] Terminating workers...');
  compressionWorker.terminate();
  decompressionWorker.terminate();
  console.log('[Streaming] Workers terminated');
}
