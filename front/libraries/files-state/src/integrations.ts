// segments/integration.ts - UPDATED для работы с Workers
import { sample, combine } from 'effector';
import { fileTransferDomain } from './domain';
import type { UUID } from '../../../../types/files';

// Imports from modules
import {
  fileInitialized,
  uploadCompleted,
  chunkUploadStarted,
  chunkUploaded,
  chunkUploadFailed,
  nextChunkUploadRequested
} from './segments/browser';
import {
  fileMetadataCreateRequested,
  fileMetadataUpdateRequested,
  $fileMetadataCache,
  chunkMetadataSaveRequested,
  chunkMetadataSaved,
  $chunks,
  $files
} from './segments/files';

import {
  compressionStarted,
  compressionCompleted,
  chunkPrepared
} from './segments/streaming';

import {
  blockSaveRequested,
  blockSaved,
  blockSaveFailed
} from './segments/store';

// Old download helpers removed - download logic now in browser.ts

// ==========================================
// BROWSER <-> FILES
// ==========================================

// Browser -> Files: создание метаданных файла
sample({
  clock: fileInitialized,
  target: fileMetadataCreateRequested
});

// Download logic moved to browser.ts -> downloadFileFx

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

sample({
  clock: compressionCompleted,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => cache.has(fileId),
  fn: (cache, { fileId, totalChunks }) => ({
    fileId,
    patch: {
      chunksCount: totalChunks,
      status: 'uploading'
    }
  }),
  target: fileMetadataUpdateRequested
});

// Streaming -> Browser: chunk подготовлен, добавляем в состояние
$chunks.on(chunkPrepared, (state, { fileId, chunkNumber, data, originalSize, compression }) => {
  const key = `${fileId}-${chunkNumber}`;
  const newMap = new Map(state);
  newMap.set(key, {
    fileId,
    chunkNumber,
    data,
    originalSize,
    compression,
    status: 'prepared',
    retryCount: 0
  });
  return newMap;
});

sample({
  clock: uploadCompleted,
  source: $fileMetadataCache,
  filter: (cache, fileId) => cache.has(fileId),
  fn: (_, fileId) => ({
    fileId,
    patch: {
      status: 'uploaded'
    }
  }),
  target: fileMetadataUpdateRequested
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
    const result = file?.status !== 'paused' && chunk !== undefined;
    console.log(`[Integration] chunkUploadStarted filter: chunk=${chunkNumber}, fileStatus=${file?.status}, chunkExists=${!!chunk}, pass=${result}`);
    return result;
  },
  fn: ({ chunks }, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key)!;
    console.log(`[Integration] -> blockSaveRequested: chunk=${chunkNumber}, dataSize=${chunk.data.length}, originalSize=${chunk.originalSize}`);
    return {
      fileId,
      chunkNumber,
      data: chunk.data,
      originalSize: chunk.originalSize,
      compression: chunk.compression
    };
  },
  target: blockSaveRequested
});

// Store -> Files: блок сохранен, сохраняем hash и метаданные
sample({
  clock: blockSaved,
  fn: ({ fileId, chunkNumber, hash, chunkSize }) => {
    console.log(`[Integration] blockSaved -> chunkMetadataSaveRequested: chunk=${chunkNumber}, hash=${hash}, chunkSize=${chunkSize}`);

    return {
      fileId,
      chunkNumber,
      hash,
      chunkSize
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
  console.log('[Integration] $pendingChunkHashes.on(blockSaved):', { fileId, chunkNumber, hash });
  newMap.set(key, { fileId, chunkNumber, hash });
  return newMap;
});

sample({
  clock: chunkMetadataSaved,
  source: $pendingChunkHashes,
  fn: (pending, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const data = pending.get(key);

    console.log('[Integration] chunkMetadataSaved -> chunkUploaded:', { fileId, chunkNumber, hasPending: !!data });

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

// ==========================================
// ERROR HANDLING
// ==========================================

// Store -> Browser: ошибка сохранения блока
sample({
  clock: blockSaveFailed,
  fn: ({ fileId, chunkNumber, error }) => {
    console.error(`[Integration] blockSaveFailed -> chunkUploadFailed: chunk=${chunkNumber}, error=`, error);
    return {
      fileId,
      chunkNumber,
      error
    };
  },
  target: chunkUploadFailed
});
