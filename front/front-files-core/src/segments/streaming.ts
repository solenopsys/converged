import { fileTransferDomain } from '../domain';
import { type UUID,  FileChunk } from "../../../../types/files";
import { BLOCK_SIZE, COMPRESSION_LEVEL } from '../config';
import { Deflate, Inflate } from 'fflate';
import { sample } from 'effector';
import { fileChunksLoaded, } from './files';
import { blockLoadRequested, blockLoaded } from './store';


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

export const decompressionChunkProcessed = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  decompressed: Uint8Array;
}>();

export const decompressionCompleted = fileTransferDomain.createEvent<UUID>();

// Effects - атомарные операции
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
  return new Promise((resolve, reject) => {
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
  return new Promise((resolve, reject) => {
    const inflate = new Inflate();
    inflate.ondata = (decompressed) => {
      resolve(decompressed);
    };
    inflate.push(data, final);
  });
});

// Stores для streaming state
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

// Logic - компрессия через рекурсивные события
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
  fn: ({ fileId, data, done }) => ({
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

// КРИТИЧЕСКИ ВАЖНО: Разбиение на блоки происходит ПОСЛЕ сжатия!
// Поток: Файл → читаем → сжимаем (Deflate) → буфер СЖАТЫХ данных → разбиваем на блоки 1MB
// Это обеспечивает фиксированные размеры блоков для блочного хранилища
$compressionState.on(compressionDataProcessed, (state, { fileId, compressed, final }) => {
  const compressionData = state.get(fileId);
  if (!compressionData) return state;

  // Добавляем СЖАТЫЕ данные в буфер
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

// Разбиваем буфер СЖАТЫХ данных на блоки по 1MB (фиксированный размер для хранилища)
// ВАЖНО: buffer содержит УЖЕ СЖАТЫЕ данные через Deflate!
// Каждый блок будет ровно 1MB (кроме последнего)
sample({
  clock: compressionDataProcessed,
  source: $compressionState,
  filter: (state, { fileId, final }) => {
    const compressionData = state.get(fileId);
    return compressionData !== undefined &&
      (compressionData.buffer.length >= BLOCK_SIZE || final);
  },
  fn: (state, { fileId, final }) => {
    const compressionData = state.get(fileId)!;
    const chunks: { fileId: UUID; chunkNumber: number; data: Uint8Array }[] = [];
    let buffer = compressionData.buffer;
    let blockNumber = compressionData.blockNumber;

    // Нарезаем сжатый буфер на блоки по 1MB
    while (buffer.length >= BLOCK_SIZE) {
      chunks.push({
        fileId,
        chunkNumber: blockNumber++,
        data: buffer.slice(0, BLOCK_SIZE)  // Ровно 1MB сжатых данных
      });
      buffer = buffer.slice(BLOCK_SIZE);
    }

    // Последний блок (может быть < 1MB)
    if (final && buffer.length > 0) {
      chunks.push({
        fileId,
        chunkNumber: blockNumber++,
        data: buffer
      });
    }

    // Обновляем state
    const newMap = new Map(state);
    newMap.set(fileId, {
      ...compressionData,
      buffer,
      blockNumber
    });
    $compressionState.setState(newMap);

    return { fileId, chunks, final, totalChunks: blockNumber };
  }
});

// Генерируем события для каждого готового блока СЖАТЫХ данных
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
      data: compressionData.buffer.slice(0, BLOCK_SIZE)  // Блок 1MB сжатых данных
    };
  },
  target: chunkPrepared
});

// Рекурсивно читаем следующий chunk
sample({
  clock: compressionDataProcessed,
  source: $compressionState,
  filter: (state, { fileId, final }) => !final,
  fn: (state, { fileId }) => {
    const compressionData = state.get(fileId);
    return { reader: compressionData!.reader! };
  },
  target: readFileChunkFx
});

// Завершение компрессии
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

// Logic - декомпрессия через рекурсивные события
$decompressionState.on(fileChunksLoaded, (state, { fileId, chunks }) => {
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
  clock: decompressionStarted,
  source: $decompressionState,
  fn: (state, { fileId }) => ({
    fileId,
    chunkNumber: 0
  }),
  target: decompressionChunkRequested
});

sample({
  clock: decompressionChunkRequested,
  source: $decompressionState,
  fn: (state, { fileId, chunkNumber }) => {
    const decompState = state.get(fileId)!;
    const chunk = decompState.chunks[chunkNumber];
    return {
      fileId,
      hash: chunk.hash,
      chunkNumber
    };
  },
  target: blockLoadRequested
});

sample({
  clock: blockLoaded,
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
  source: blockLoaded,
  fn: (request, decompressed) => ({
    fileId: request.fileId,
    chunkNumber: request.chunkNumber,
    decompressed
  }),
  target: decompressionChunkProcessed
});

// Рекурсивно запрашиваем следующий chunk
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

// Завершение декомпрессии
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