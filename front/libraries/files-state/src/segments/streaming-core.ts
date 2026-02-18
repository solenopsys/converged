// streaming-core.ts - события и состояния без worker'ов (для тестов)
import { fileTransferDomain } from '../domain';
import { $fileMetadataCache, $fileChunksCache } from './files';
import { type UUID } from "../../../../../types/files";
import { sample, combine } from 'effector';

// ==========================================
// EVENTS
// ==========================================

export const compressionStarted = fileTransferDomain.createEvent<{
  fileId: UUID;
  file: File;
}>('COMPRESSION_STARTED');

export const chunkPrepared = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
  originalSize: number;
  compression: 'none' | 'deflate';
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
// STORES
// ==========================================

export const $decompressionState = fileTransferDomain.createStore<Map<UUID, {
  currentChunkNumber: number;
  totalChunks: number;
}>>(new Map(), { name: 'DECOMPRESSION_STATE' });

// Установка состояния декомпрессии
$decompressionState.on(decompressionStateInitialized, (state, { fileId, totalChunks }) => {
  console.log('[streaming-core] decompressionStateInitialized:', { fileId, totalChunks });
  const newMap = new Map(state);
  newMap.set(fileId, {
    currentChunkNumber: 0,
    totalChunks
  });
  return newMap;
});

// ==========================================
// DECOMPRESSION LOGIC
// ==========================================

// Инициализация состояния декомпрессии
sample({
  clock: decompressionStarted,
  source: combine({ metadata: $fileMetadataCache, chunks: $fileChunksCache }),
  filter: ({ chunks }, { fileId }) => {
    const hasChunks = chunks.has(fileId);
    console.log('[streaming-core] decompressionStarted -> check chunks:', { fileId, hasChunks });
    return hasChunks;
  },
  fn: ({ chunks }, { fileId }) => {
    const fileChunks = chunks.get(fileId)!;
    const totalChunks = fileChunks.length;
    console.log('[streaming-core] Initializing decompression state:', { fileId, totalChunks });
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

// После инициализации состояния запрашиваем первый чанк
sample({
  clock: decompressionStateInitialized,
  fn: ({ fileId }) => {
    console.log('[streaming-core] Requesting first chunk for:', fileId);
    return { fileId, chunkNumber: 0 };
  },
  target: decompressionChunkRequested
});
