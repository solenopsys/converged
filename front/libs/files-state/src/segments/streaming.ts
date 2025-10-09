import { fileTransferDomain } from '../domain';
import { $fileMetadataCache } from './files';
import { type UUID, FileChunk } from "../../../../../types/files";
import { BLOCK_SIZE, COMPRESSION_LEVEL } from '../config';
import { Deflate, Inflate } from 'fflate';
import { sample } from 'effector';

// Events
export const compressionStarted = fileTransferDomain.createEvent<{
  fileId: UUID;
  file: File;
}>('COMPRESSION_STARTED');

export const compressionChunkRead = fileTransferDomain.createEvent<{
  fileId: UUID;
  data: Uint8Array;
  done: boolean;
}>('COMPRESSION_CHUNK_READ');

export const compressionDataProcessed = fileTransferDomain.createEvent<{
  fileId: UUID;
  compressed: Uint8Array;
  final: boolean;
}>('COMPRESSION_DATA_PROCESSED');

export const chunkPrepared = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>('CHUNK_PREPARED');

export const compressionCompleted = fileTransferDomain.createEvent<{
  fileId: UUID;
  totalChunks: number;
}>('COMPRESSION_COMPLETED');

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

// Effects
export const readFileChunkFx = fileTransferDomain.createEffect<
  { reader: ReadableStreamDefaultReader<Uint8Array> },
  { data?: Uint8Array; done: boolean }
>('READ_FILE_CHUNK_FX');
readFileChunkFx.use(async ({ reader }) => {
  const result = await reader.read();
  return { data: result.value, done: result.done };
});

export const compressDataFx = fileTransferDomain.createEffect<
  { data: Uint8Array; final: boolean },
  { compressed: Uint8Array; final: boolean }
>('COMPRESS_DATA_FX');
compressDataFx.use(async ({ data, final }) => {
  return new Promise((resolve) => {
    const deflate = new Deflate({ level: COMPRESSION_LEVEL });
    deflate.ondata = (compressed, isFinal) => {
      resolve({ compressed, final: isFinal });
    };
    deflate.push(data, final);
  });
});

export const decompressDataFx = fileTransferDomain.createEffect<
  { data: Uint8Array; final: boolean },
  Uint8Array
>('DECOMPRESS_DATA_FX');
decompressDataFx.use(async ({ data, final }) => {
  return new Promise((resolve) => {
    const inflate = new Inflate();
    inflate.ondata = (decompressed) => {
      resolve(decompressed);
    };
    inflate.push(data, final);
  });
});

// Stores
export const $compressionState = fileTransferDomain.createStore<Map<UUID, {
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  buffer: Uint8Array;
  blockNumber: number;
}>>(new Map(), { name: 'COMPRESSION_STATE' });

export const $decompressionState = fileTransferDomain.createStore<Map<UUID, {
  currentChunkNumber: number;
  totalChunks: number;
}>>(new Map(), { name: 'DECOMPRESSION_STATE' });

// Compression logic
$compressionState.on(compressionStarted, (state, { fileId, file }) => {
  const reader = file.stream().getReader();
  const newMap = new Map(state);
  newMap.set(fileId, {
    reader,
    buffer: new Uint8Array(0),
    blockNumber: 0
  });
  return newMap;
});

sample({
  clock: compressionStarted,
  source: $compressionState,
  fn: (state, { fileId }) => {
    const compressionData = state.get(fileId);
    return { reader: compressionData!.reader! };
  },
  target: readFileChunkFx
});

sample({
  clock: readFileChunkFx.doneData,
  source: compressionStarted,
  fn: (request, result) => ({
    fileId: request.fileId,
    data: result.data || new Uint8Array(0),
    done: result.done
  }),
  target: compressionChunkRead
});

sample({
  clock: compressionChunkRead,
  fn: ({ data, done }) => ({
    data,
    final: done
  }),
  target: compressDataFx
});

sample({
  clock: compressDataFx.doneData,
  source: compressionChunkRead,
  fn: (request, result) => ({
    fileId: request.fileId,
    compressed: result.compressed,
    final: result.final
  }),
  target: compressionDataProcessed
});

$compressionState.on(compressionDataProcessed, (state, { fileId, compressed, final }) => {
  const compressionData = state.get(fileId);
  if (!compressionData) return state;

  const newBuffer = new Uint8Array(compressionData.buffer.length + compressed.length);
  newBuffer.set(compressionData.buffer);
  newBuffer.set(compressed, compressionData.buffer.length);

  const newMap = new Map(state);
  newMap.set(fileId, {
    ...compressionData,
    buffer: newBuffer
  });
  return newMap;
});

sample({
  clock: compressionDataProcessed,
  source: $compressionState,
  filter: (state, { fileId }) => {
    const compressionData = state.get(fileId);
    return compressionData !== undefined && compressionData.buffer.length >= BLOCK_SIZE;
  },
  fn: (state, { fileId }) => {
    const compressionData = state.get(fileId)!;
    return {
      fileId,
      chunkNumber: compressionData.blockNumber,
      data: compressionData.buffer.slice(0, BLOCK_SIZE)
    };
  },
  target: chunkPrepared
});

$compressionState.on(chunkPrepared, (state, { fileId }) => {
  const compressionData = state.get(fileId);
  if (!compressionData) return state;

  const newMap = new Map(state);
  newMap.set(fileId, {
    ...compressionData,
    buffer: compressionData.buffer.slice(BLOCK_SIZE),
    blockNumber: compressionData.blockNumber + 1
  });
  return newMap;
});

sample({
  clock: compressionDataProcessed,
  source: $compressionState,
  filter: (state, { final }) => !final,
  fn: (state, { fileId }) => {
    const compressionData = state.get(fileId);
    return { reader: compressionData!.reader! };
  },
  target: readFileChunkFx
});

sample({
  clock: compressionDataProcessed,
  source: $compressionState,
  filter: (state, { fileId, final }) => {
    const compressionData = state.get(fileId);
    return final && compressionData !== undefined && compressionData.buffer.length > 0;
  },
  fn: (state, { fileId }) => {
    const compressionData = state.get(fileId)!;
    return {
      fileId,
      chunkNumber: compressionData.blockNumber,
      data: compressionData.buffer
    };
  },
  target: chunkPrepared
});

sample({
  clock: compressionDataProcessed,
  source: $compressionState,
  filter: (state, { fileId, final }) => {
    const compressionData = state.get(fileId);
    return final && compressionData !== undefined && compressionData.buffer.length === 0;
  },
  fn: (state, { fileId }) => {
    const compressionData = state.get(fileId)!;
    return {
      fileId,
      totalChunks: compressionData.blockNumber
    };
  },
  target: compressionCompleted
});

// Decompression logic - инициализация состояния с проверкой
sample({
  clock: decompressionStarted,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => cache.has(fileId),
  fn: (cache, { fileId }) => {
    const metadata = cache.get(fileId)!;
    return { fileId, totalChunks: metadata.chunksCount };
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

sample({
  clock: decompressionDataReceived,
  source: $decompressionState,
  fn: (state, { fileId, chunkNumber, data }) => {
    const decompState = state.get(fileId);
    if (!decompState) {
      throw new Error(`Decompression state not found for ${fileId}`);
    }
    const isLast = chunkNumber === decompState.totalChunks - 1;
    return { data, final: isLast };
  },
  target: decompressDataFx
});

sample({
  clock: decompressDataFx.doneData,
  source: decompressionDataReceived,
  fn: (request, decompressed) => ({
    fileId: request.fileId,
    chunkNumber: request.chunkNumber,
    decompressed
  }),
  target: decompressionChunkProcessed
});

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
    return decompState !== undefined && chunkNumber === decompState.totalChunks - 1;
  },
  fn: (state, { fileId }) => fileId,
  target: decompressionCompleted
});