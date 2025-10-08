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
  chunkUploaded
} from './segments/browser';

import {
  fileMetadataCreateRequested,
  fileMetadataLoadRequested,
  fileMetadataLoaded,
  fileChunksLoadRequested,
  fileChunksLoaded,
  $fileMetadataCache,
  chunkMetadataSaveRequested,
  chunkMetadataSaved,
  $chunks,
  $files
} from './segments/files';

import {
  compressionStarted,
  compressionCompleted,
  chunkPrepared,
  decompressionStarted,
  decompressionChunkRequested,
  decompressionDataReceived,
  decompressionChunkProcessed,
  setDecompressionChunks,
  $decompressionState
} from './segments/streaming';

import {
  blockSaveRequested,
  blockSaved,
  blockLoadRequested,
  blockLoaded
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

// Files -> Browser: метаданные загружены, запрашиваем чанки
sample({
  clock: fileMetadataLoaded,
  fn: (metadata) => metadata.id,
  target: fileChunksLoadRequested
});

// Files -> Browser: чанки загружены, показываем диалог сохранения
sample({
  clock: fileChunksLoaded,
  source: $fileMetadataCache,
  fn: (cache, { fileId }) => ({
    fileId,
    fileName: cache.get(fileId)!.name
  }),
  target: saveDialogRequested
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

// Browser -> Streaming: начало декомпрессии
sample({
  clock: fileHandleReady,
  fn: ({ fileId }) => ({ fileId }),
  target: decompressionStarted
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
// FILES <-> STREAMING
// ==========================================

// Files -> Streaming: чанки загружены, начинаем декомпрессию
sample({
  clock: fileChunksLoaded,
  fn: ({ fileId, chunks }) => ({ fileId, chunks }),
  target: setDecompressionChunks
});

// ==========================================
// STREAMING <-> STORE (DOWNLOAD)
// ==========================================

// Streaming -> Store: запрос блока для декомпрессии
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