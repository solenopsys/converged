import { fileTransferDomain } from '../domain';
import { type UUID, FileChunk } from "../../../../types/files";
import { BLOCK_SIZE, COMPRESSION_LEVEL } from '../config';
import { Deflate, Inflate } from 'fflate';
import { sample } from 'effector';

// Events
export const compressionStarted = fileTransferDomain.createEvent<{
  fileId: UUID;
  file: File;
}>();

export const compressionChunkRead = fileTransferDomain.createEvent<{
  fileId: UUID;
  data: Uint8Array;
  done: boolean;
}>();

export const compressionDataProcessed = fileTransferDomain.createEvent<{
  fileId: UUID;
  compressed: Uint8Array;
  final: boolean;
}>();

export const chunkPrepared = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>();

export const compressionCompleted = fileTransferDomain.createEvent<{
  fileId: UUID;
  totalChunks: number;
}>();

export const decompressionStarted = fileTransferDomain.createEvent<{
  fileId: UUID;
}>();

export const decompressionChunkRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>();

export const decompressionDataReceived = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>();

export const decompressionChunkProcessed = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  decompressed: Uint8Array;
}>();

export const decompressionCompleted = fileTransferDomain.createEvent<UUID>();

export const setDecompressionChunks = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunks: FileChunk[];
}>();

// Effects
export const readFileChunkFx = fileTransferDomain.createEffect<
  { reader: ReadableStreamDefaultReader<Uint8Array> },
  { data?: Uint8Array; done: boolean }
>(async ({ reader }) => {
  const result = await reader.read();
  return { data: result.value, done: result.done };
});

export const compressDataFx = fileTransferDomain.createEffect<
  { data: Uint8Array; final: boolean },
  { compressed: Uint8Array; final: boolean }
>(async ({ data, final }) => {
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
>(async ({ data, final }) => {
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
}>>(new Map());

export const $decompressionState = fileTransferDomain.createStore<Map<UUID, {
  currentChunkNumber: number;
  totalChunks: number;
  chunks: FileChunk[];
}>>(new Map());

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

// Decompression logic
$decompressionState.on(setDecompressionChunks, (state, { fileId, chunks }) => {
  const sorted = [...chunks].sort((a, b) => a.chunkNumber - b.chunkNumber);
  const newMap = new Map(state);
  newMap.set(fileId, {
    currentChunkNumber: 0,
    totalChunks: sorted.length,
    chunks: sorted
  });
  return newMap;
});

sample({
  clock: setDecompressionChunks,
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
    const decompState = state.get(fileId)!;
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