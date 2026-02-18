// integrations.test.ts - версия для тестов БЕЗ импорта воркера
// Копия integrations.ts но с импортом streaming-core вместо streaming

import { sample, combine } from 'effector';
import { fileTransferDomain } from './domain';
import type { UUID } from '../../../../types/files';

// Imports from modules
import {
  fileInitialized,
  downloadRequested,
  saveDialogRequested,
  downloadCancelled,
  showSaveDialogFx,
  fileHandleReady,
  $fileHandles,
  $downloadOffsets,
  $downloadMode,
  $downloadBuffers,
  downloadBufferAppended,
  downloadBufferCleared,
  downloadBufferedFileFx,
  downloadOffsetAdvanced,
  writeChunkRequested,
  writeChunkFx,
  chunkWritten,
  uploadCompleted,
  chunkUploadStarted,
  chunkUploaded,
  chunkUploadFailed,
  nextChunkUploadRequested
} from './segments/browser';
import {
  fileMetadataCreateRequested,
  fileMetadataLoadRequested,
  fileMetadataLoaded,
  fileMetadataUpdateRequested,
  $fileMetadataCache,
  fileChunksLoadRequested,
  fileChunksLoaded,
  fileChunksLoadFailed,
  $fileChunksCache,
  chunkMetadataSaveRequested,
  chunkMetadataSaved,
  $chunks,
  $files,
  chunkLoadRequested,
  chunkLoaded
} from './segments/files';

// ВАЖНО: импортируем из streaming-core, а не из streaming!
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
  decompressionCompleted,
  $decompressionState,
  chunkConsumed
} from './segments/streaming-core';

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

const writeChunkPrepared = fileTransferDomain.createEvent<{
  fileId: UUID;
  handle: any;
  chunk: Uint8Array;
  position: number;
  nextOffset: number;
}>('WRITE_CHUNK_PREPARED');

const $downloadPrereqs = combine({
  chunks: $fileChunksCache,
  downloadMode: $downloadMode,
  decompression: $decompressionState,
});

const canStartDecompression = (
  state: {
    chunks: Map<UUID, unknown>;
    downloadMode: Map<UUID, string>;
    decompression: Map<UUID, unknown>;
  },
  fileId: UUID
): boolean => {
  const hasChunks = state.chunks.has(fileId);
  const hasMode = state.downloadMode.has(fileId);
  const notStarted = !state.decompression.has(fileId);
  return hasChunks && hasMode && notStarted;
};

// ==========================================
// КРИТИЧЕСКАЯ СВЯЗЬ: blockSaved -> chunkMetadataSaveRequested
// ==========================================

// Store -> Files: блок сохранен, сохраняем hash и метаданные
sample({
  clock: blockSaved,
  source: $chunks,
  fn: (chunks, { fileId, chunkNumber, hash }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    console.log(`[Integration] blockSaved -> chunkMetadataSaveRequested: chunk=${chunkNumber}, hash=${hash}`);

    return {
      fileId,
      chunkNumber,
      hash,
      chunkSize: chunk ? chunk.data.length : 0
    };
  },
  target: chunkMetadataSaveRequested
});

// Files -> Browser: метаданные чанка сохранены, обновляем UI
sample({
  clock: chunkMetadataSaved,
  fn: ({ fileId, chunkNumber, hash }) => {
    console.log(`[Integration] chunkMetadataSaved -> chunkUploaded: chunk=${chunkNumber}, hash=${hash}`);
    return { fileId, chunkNumber };
  },
  target: chunkUploaded
});

console.log('[Integrations.test] Test integrations loaded (without worker)');
