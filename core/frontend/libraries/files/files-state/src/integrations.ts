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

// BROWSER <-> FILES

sample({
  clock: fileInitialized,
  target: fileMetadataCreateRequested
});


// BROWSER <-> STREAMING

sample({
  clock: fileInitialized,
  fn: ({ fileId, file }) => ({ fileId, file }),
  target: compressionStarted
});

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

// STREAMING <-> STORE <-> FILES (UPLOAD)

sample({
  clock: chunkPrepared,
  fn: ({ fileId }) => fileId,
  target: nextChunkUploadRequested
});

sample({
  clock: chunkUploadStarted,
  source: combine({ chunks: $chunks, files: $files }),
  filter: ({ files, chunks }, { fileId, chunkNumber }) => {
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
      data: chunk.data,
      originalSize: chunk.originalSize,
      compression: chunk.compression
    };
  },
  target: blockSaveRequested
});

sample({
  clock: blockSaved,
  fn: ({ fileId, chunkNumber, hash, chunkSize }) => ({ fileId, chunkNumber, hash, chunkSize }),
  target: chunkMetadataSaveRequested
});

const $pendingChunkHashes = fileTransferDomain.createStore<Map<string, { fileId: UUID; chunkNumber: number; hash: string }>>(
  new Map(),
  { name: 'PENDING_CHUNK_HASHES' }
);

$pendingChunkHashes.on(blockSaved, (state, { fileId, chunkNumber, hash }) => {
  const newMap = new Map(state);
  newMap.set(`${fileId}-${chunkNumber}`, { fileId, chunkNumber, hash });
  return newMap;
});

sample({
  clock: chunkMetadataSaved,
  source: $pendingChunkHashes,
  fn: (pending, { fileId, chunkNumber }) => {
    const data = pending.get(`${fileId}-${chunkNumber}`);
    if (!data) return { fileId, chunkNumber, hash: '' as any };
    return { fileId: data.fileId, chunkNumber: data.chunkNumber, hash: data.hash as any };
  },
  target: chunkUploaded
});

$pendingChunkHashes.on(chunkUploaded, (state, { fileId, chunkNumber }) => {
  const newMap = new Map(state);
  const key = `${fileId}-${chunkNumber}`;
  newMap.delete(key);
  return newMap;
});


// ERROR HANDLING

sample({
  clock: blockSaveFailed,
  fn: ({ fileId, chunkNumber, error }) => ({ fileId, chunkNumber, error }),
  target: chunkUploadFailed
});
