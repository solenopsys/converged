import { sample, combine } from 'effector';

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
  chunkUploadFailed
} from './segments/browser';
import {
  fileMetadataCreateRequested,
  fileMetadataLoadRequested,
  fileMetadataLoaded,
  $fileMetadataCache,
  chunkMetadataSaveRequested,
  chunkMetadataSaved,
  $chunks,
  $files,
  chunkLoadRequested,
  chunkLoaded
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
  $decompressionState
} from './segments/streaming';

import {
  blockSaveRequested,
  blockSaved,
  blockLoadRequested,
  blockLoaded,
  blockSaveFailed,
  blockLoadFailed
} from './segments/store';

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

// Browser -> Streaming: начало декомпрессии (после загрузки метаданных)
sample({
  clock: fileMetadataLoaded,
  fn: ({ id }) => ({ fileId: id }),
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
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => cache.has(fileId),
  fn: (cache, { fileId, chunkNumber }) => {
    const metadata = cache.get(fileId)!;
    
    // В реальном приложении нужно получить hash чанка из метаданных
    // Здесь используем заглушку
    const hash = `chunk-${fileId}-${chunkNumber}` as any;
    
    return {
      fileId,
      hash,
      chunkNumber
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
// BROWSER <-> STORE <-> FILES (UPLOAD)
// ==========================================

// Browser -> Store: начинаем сохранение блока
sample({
  clock: chunkUploadStarted,
  source: combine({ chunks: $chunks, files: $files }),
  filter: ({ files }, { fileId }) => files.get(fileId)?.status !== 'paused',
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

// Store -> Files: блок сохранен, сохраняем метаданные
sample({
  clock: blockSaved,
  fn: ({ fileId, chunkNumber, hash }) => ({
    fileId,
    chunkNumber,
    hash,
    chunkSize: $chunks.getState().get(`${fileId}-${chunkNumber}`)!.data.length
  }),
  target: chunkMetadataSaveRequested
});

// Files -> Browser: метаданные чанка сохранены, отмечаем загруженным
sample({
  clock: chunkMetadataSaved,
  source: blockSaved,
  fn: (blockData, metaData) => ({
    fileId: metaData.fileId,
    chunkNumber: metaData.chunkNumber,
    hash: blockData.hash
  }),
  target: chunkUploaded
});

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