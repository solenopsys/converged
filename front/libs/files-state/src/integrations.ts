// segments/integration.ts - UPDATED для работы с Workers
import { sample, combine } from 'effector';
import { fileTransferDomain } from './domain';
import type { UUID } from '../../../../types/files';

// Imports from modules
import {
  fileInitialized,
  downloadRequested,
  saveDialogRequested,
  showSaveDialogFx,
  fileHandleReady,
  $fileHandles,
  writeChunkRequested,
  writeChunkFx,
  chunkWritten,
  chunkUploadStarted,
  chunkUploaded,
  chunkUploadFailed,
  nextChunkUploadRequested
} from './segments/browser';
import {
  fileMetadataCreateRequested,
  fileMetadataLoadRequested,
  fileMetadataLoaded,
  fileMetadataLoadFailed,
  $fileMetadataCache,
  chunkMetadataSaveRequested,
  chunkMetadataSaved,
  $chunks,
  $files,
  chunkLoadRequested,
  chunkLoaded,
  fileChunksLoadRequested,
  fileChunksLoaded,
  fileChunksLoadFailed,
  $fileChunkHashes
} from './segments/files';

import {
  compressionStarted,
  compressionCompleted,
  chunkPrepared,
  decompressionStarted,
  decompressionStateInitialized,
  decompressionFailed,
  decompressionChunkRequested,
  decompressionDataReceived,
  decompressionChunkProcessed,
  $decompressionState,
  chunkConsumed,
  decompressionCompleted
} from './segments/streaming';

import {
  blockSaveRequested,
  blockSaved,
  blockLoadRequested,
  blockLoaded,
  blockSaveFailed,
  blockLoadFailed
} from './segments/store';

const chunkUploadStartedFx = fileTransferDomain.createEffect<{
  fileId: any;
  chunkNumber: number;
}>('CHUNK_UPLOAD_STARTED_FX');

chunkUploadStartedFx.use(async (params) => {
  chunkUploadStarted(params);
});

const $pendingDownloads = fileTransferDomain.createStore<Set<UUID>>(new Set(), {
  name: 'PENDING_DOWNLOADS'
});

$pendingDownloads
  .on(downloadRequested, (state, fileId) => {
    const next = new Set(state);
    next.add(fileId);
    return next;
  })
  .on(decompressionCompleted, (state, fileId) => {
    if (!state.has(fileId)) return state;
    const next = new Set(state);
    next.delete(fileId);
    return next;
  })
  .on(fileChunksLoadFailed, (state, { fileId }) => {
    if (!state.has(fileId)) return state;
    const next = new Set(state);
    next.delete(fileId);
    return next;
  })
  .on(fileMetadataLoadFailed, (state, { fileId }) => {
    if (!state.has(fileId)) return state;
    const next = new Set(state);
    next.delete(fileId);
    return next;
  });

const downloadReady = fileTransferDomain.createEvent<UUID>('DOWNLOAD_READY');

// ==========================================
// BROWSER <-> FILES
// ==========================================

// Browser -> Files: создание метаданных файла
sample({
  clock: fileInitialized,
  target: fileMetadataCreateRequested
});

// Browser -> Files: загрузка метаданных файла
sample({
  clock: downloadRequested,
  target: fileMetadataLoadRequested
});

sample({
  clock: downloadRequested,
  target: fileChunksLoadRequested
});

// ==========================================
// BROWSER <-> STREAMING
// ==========================================

// Browser -> Streaming: начало компрессии файла
sample({
  clock: fileInitialized,
  fn: ({ fileId, file }) => ({ fileId, file }),
  target: compressionStarted
});

// Streaming -> Browser: компрессия завершена, обновляем состояние файла
$files.on(compressionCompleted, (state, { fileId, totalChunks }) => {
  const file = state.get(fileId);
  if (!file) return state;

  const newMap = new Map(state);
  newMap.set(fileId, { ...file, totalChunks, status: 'uploading' });
  return newMap;
});

// Streaming -> Browser: chunk подготовлен, добавляем в состояние
$chunks.on(chunkPrepared, (state, { fileId, chunkNumber, data }) => {
  const key = `${fileId}-${chunkNumber}`;
  const newMap = new Map(state);
  newMap.set(key, {
    fileId,
    chunkNumber,
    data,
    status: 'prepared',
    retryCount: 0
  });
  return newMap;
});

// Browser -> Streaming: подготовка к декомпрессии (ждем метаданные и хэши чанков)
sample({
  clock: fileMetadataLoaded,
  source: {
    pending: $pendingDownloads,
    hashes: $fileChunkHashes,
  },
  filter: ({ pending, hashes }, metadata) =>
    pending.has(metadata.id) && hashes.has(metadata.id),
  fn: (_, { id }) => id,
  target: downloadReady
});

sample({
  clock: fileChunksLoaded,
  source: {
    pending: $pendingDownloads,
    metadata: $fileMetadataCache,
  },
  filter: ({ pending, metadata }, { fileId }) =>
    pending.has(fileId) && metadata.has(fileId),
  fn: (_, { fileId }) => fileId,
  target: downloadReady
});

sample({
  clock: downloadReady,
  fn: (fileId) => ({ fileId }),
  target: decompressionStarted
});

// Browser -> Streaming: диалог сохранения готов, показываем его (только если метаданные есть)
sample({
  clock: decompressionStateInitialized,
  source: $fileMetadataCache,
  fn: (cache, { fileId }) => {
    const metadata = cache.get(fileId)!;
    return {
      fileId,
      fileName: metadata.name
    };
  },
  target: saveDialogRequested
});

// Streaming -> Browser: chunk декомпрессирован, записываем в файл
sample({
  clock: decompressionChunkProcessed,
  fn: ({ fileId, decompressed }) => ({
    fileId,
    chunk: decompressed
  }),
  target: writeChunkRequested
});

// ==========================================
// STREAMING <-> STORE (DOWNLOAD)
// ==========================================

// Streaming -> Store: запрос блока для декомпрессии
sample({
  clock: decompressionChunkRequested,
  source: $fileChunkHashes,
  filter: (hashes, { fileId, chunkNumber }) => {
    const fileHashes = hashes.get(fileId);
    return fileHashes !== undefined && fileHashes.has(chunkNumber);
  },
  fn: (hashes, { fileId, chunkNumber }) => {
    const fileHashes = hashes.get(fileId)!;
    return {
      fileId,
      chunkNumber,
      hash: fileHashes.get(chunkNumber)!
    };
  },
  target: blockLoadRequested
});

// Store -> Streaming: блок загружен, передаем в декомпрессор
sample({
  clock: blockLoaded,
  fn: ({ fileId, chunkNumber, data }) => ({
    fileId,
    chunkNumber,
    data
  }),
  target: decompressionDataReceived
});

// ==========================================
// STREAMING <-> STORE <-> FILES (UPLOAD)
// ==========================================

// NOTE: Убран прямой запуск загрузки из chunkPrepared для предотвращения дублирования.
// Теперь загрузка управляется только через очередь в browser.ts (nextChunkUploadRequested)
// Streaming -> Browser: chunk подготовлен, запускаем загрузку через очередь
sample({
  clock: chunkPrepared,
  fn: ({ fileId }) => fileId,
  target: nextChunkUploadRequested
});

// Browser -> Store: начинаем сохранение блока
sample({
  clock: chunkUploadStarted,
  source: combine({ chunks: $chunks, files: $files }),
  filter: ({ files, chunks }, { fileId, chunkNumber }) => {
    // Проверяем что файл не на паузе и chunk существует
    const file = files.get(fileId);
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    return file?.status !== 'paused' && chunk !== undefined;
  },
  fn: ({ chunks }, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key)!;
    return {
      fileId,
      chunkNumber,
      data: chunk.data
    };
  },
  target: blockSaveRequested
});

// Store -> Files: блок сохранен, сохраняем hash и метаданные
sample({
  clock: blockSaved,
  source: $chunks,
  fn: (chunks, { fileId, chunkNumber, hash }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    
    return {
      fileId,
      chunkNumber,
      hash,
      chunkSize: chunk ? chunk.data.length : 0
    };
  },
  target: chunkMetadataSaveRequested
});

// Files -> Browser: метаданные чанка сохранены, отмечаем загруженным
// Берем hash из blockSaved события
const $pendingChunkHashes = fileTransferDomain.createStore<Map<string, { fileId: UUID; chunkNumber: number; hash: string }>>(
  new Map(),
  { name: 'PENDING_CHUNK_HASHES' }
);

$pendingChunkHashes.on(blockSaved, (state, { fileId, chunkNumber, hash }) => {
  const newMap = new Map(state);
  const key = `${fileId}-${chunkNumber}`;
  newMap.set(key, { fileId, chunkNumber, hash });
  return newMap;
});

sample({
  clock: chunkMetadataSaved,
  source: $pendingChunkHashes,
  fn: (pending, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const data = pending.get(key);
    
    if (!data) {
      console.error('[Integration] Missing hash for chunk:', { fileId, chunkNumber });
      return { fileId, chunkNumber, hash: '' as any };
    }
    
    return {
      fileId: data.fileId,
      chunkNumber: data.chunkNumber,
      hash: data.hash as any
    };
  },
  target: chunkUploaded
});

// Очищаем после использования
$pendingChunkHashes.on(chunkUploaded, (state, { fileId, chunkNumber }) => {
  const newMap = new Map(state);
  const key = `${fileId}-${chunkNumber}`;
  newMap.delete(key);
  return newMap;
});

// ==========================================
// BACKPRESSURE для Compression Worker
// ==========================================

// После успешного upload - сигнализируем worker что можно следующий chunk
sample({
  clock: chunkUploaded,
  fn: ({ fileId }) => fileId,
  target: chunkConsumed
});

// ==========================================
// ERROR HANDLING
// ==========================================

// Store -> Browser: ошибка сохранения блока
sample({
  clock: blockSaveFailed,
  fn: ({ fileId, chunkNumber, error }) => ({
    fileId,
    chunkNumber,
    error
  }),
  target: chunkUploadFailed
});

// Store -> Browser: ошибка загрузки блока
sample({
  clock: blockLoadFailed,
  fn: ({ fileId, chunkNumber, error }) => {
    console.error(`Failed to load block ${chunkNumber} for file ${fileId}:`, error);
  }
});

// Streaming -> Browser: ошибка декомпрессии
sample({
  clock: decompressionFailed,
  fn: ({ fileId, error }) => {
    console.error(`Decompression failed for file ${fileId}:`, error);
  }
});

// ==========================================
// BROWSER SAVE DIALOG
// ==========================================

// Browser: показываем диалог сохранения
sample({
  clock: saveDialogRequested,
  fn: ({ fileName }) => ({ fileName }),
  target: showSaveDialogFx
});

// Browser: сохраняем handle файла
sample({
  clock: showSaveDialogFx.doneData,
  source: saveDialogRequested,
  fn: (request, handle) => ({
    fileId: request.fileId,
    handle
  }),
  target: fileHandleReady
});

$fileHandles.on(fileHandleReady, (state, { fileId, handle }) => {
  const newMap = new Map(state);
  newMap.set(fileId, handle);
  return newMap;
});

// ==========================================
// BROWSER WRITE CHUNK
// ==========================================

// Browser: запись чанка в файл
sample({
  clock: writeChunkRequested,
  source: $fileHandles,
  fn: (handles, { fileId, chunk }) => ({
    handle: handles.get(fileId),
    chunk
  }),
  target: writeChunkFx
});

sample({
  clock: writeChunkFx.doneData,
  source: writeChunkRequested,
  fn: (request) => request.fileId,
  target: chunkWritten
});
