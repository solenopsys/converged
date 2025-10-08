import { sample, combine } from 'effector';
import { fileTransferDomain } from "../domain";
import { FileMetadata, FileChunk, UUID, HashString } from "../../../../types/files";
import { services } from "../services";

// Types
export type ChunkStatus = 'prepared' | 'uploading' | 'uploaded' | 'failed';

export type ChunkState = {
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
  hash?: HashString;
  status: ChunkStatus;
  error?: string;
  retryCount: number;
}

export type FileUploadState = {
  fileId: UUID;
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number | null;
  status: 'compressing' | 'uploading' | 'completed' | 'failed' | 'paused';
  error?: string;
}

// Events
export const fileMetadataCreateRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  file: File;
  owner: string;
}>();

export const fileMetadataCreated = fileTransferDomain.createEvent<UUID>();

export const fileMetadataSaveFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  error: Error;
}>();

export const chunkMetadataSaveRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  hash: HashString;
  chunkSize: number;
}>();

export const chunkMetadataSaved = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>();

export const chunkMetadataSaveFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  error: Error;
}>();

export const fileMetadataLoadRequested = fileTransferDomain.createEvent<UUID>();

export const fileMetadataLoaded = fileTransferDomain.createEvent<FileMetadata>();

export const fileMetadataLoadFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  error: Error;
}>();

export const chunkLoadRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>();

export const chunkLoaded = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>();

// Effects
export const saveFileMetadataFx = fileTransferDomain.createEffect<
  FileMetadata,
  UUID
>(async (file) => services.filesService.save(file));

export const saveChunkMetadataFx = fileTransferDomain.createEffect<
  FileChunk,
  HashString
>(async (chunk) => services.filesService.saveChunk(chunk));

export const loadFileMetadataFx = fileTransferDomain.createEffect<
  UUID,
  FileMetadata
>(async (id) => services.filesService.get(id));

export const loadChunkFx = fileTransferDomain.createEffect<
  { fileId: UUID; chunkNumber: number },
  { fileId: UUID; chunkNumber: number; data: Uint8Array }
>(async ({ fileId, chunkNumber }) => {
  // This is a placeholder for the actual implementation of loading a single chunk.
  // In a real application, this would make a request to the server to get the chunk data.
  const data = new Uint8Array(0);
  return { fileId, chunkNumber, data };
});

// Stores
export const $files = fileTransferDomain.createStore<Map<UUID, FileUploadState>>(new Map());
export const $chunks = fileTransferDomain.createStore<Map<string, ChunkState>>(new Map());
export const $fileMetadataCache = fileTransferDomain.createStore<Map<UUID, FileMetadata>>(new Map());

// Derived
export const $uploadingFiles = $files.map(files =>
  Array.from(files.values()).filter(f => f.status === 'uploading')
);

export const getFileProgress = (fileId: UUID) =>
  combine($chunks, $files, (chunks, files) => {
    const file = files.get(fileId);
    if (!file) return null;

    const fileChunks = Array.from(chunks.values()).filter(c => c.fileId === fileId);
    const uploaded = fileChunks.filter(c => c.status === 'uploaded').length;

    return {
      total: file.totalChunks,
      uploaded,
      failed: fileChunks.filter(c => c.status === 'failed').length,
      uploading: fileChunks.filter(c => c.status === 'uploading').length,
      prepared: fileChunks.filter(c => c.status === 'prepared').length,
      progress: file.totalChunks ? Math.round((uploaded / file.totalChunks) * 100) : 0
    };
  });

// Logic
sample({
  clock: fileMetadataCreateRequested,
  fn: ({ fileId, file, owner }) => ({
    id: fileId,
    hash: '',
    status: 'compressing' as const,
    name: file.name,
    fileSize: file.size,
    fileType: file.type,
    compression: 'deflate',
    owner,
    createdAt: new Date().toISOString(),
    chunksCount: 0
  }),
  target: saveFileMetadataFx
});

sample({
  clock: saveFileMetadataFx.doneData,
  target: fileMetadataCreated
});

sample({
  clock: saveFileMetadataFx.fail,
  source: fileMetadataCreateRequested,
  fn: (request, { error }) => ({
    fileId: request.fileId,
    error
  }),
  target: fileMetadataSaveFailed
});

sample({
  clock: chunkMetadataSaveRequested,
  fn: ({ fileId, chunkNumber, hash, chunkSize }) => ({
    fileId,
    hash,
    chunkNumber,
    chunkSize,
    createdAt: new Date().toISOString()
  }),
  target: saveChunkMetadataFx
});

sample({
  clock: saveChunkMetadataFx.doneData,
  source: chunkMetadataSaveRequested,
  fn: (request) => ({
    fileId: request.fileId,
    chunkNumber: request.chunkNumber
  }),
  target: chunkMetadataSaved
});

sample({
  clock: saveChunkMetadataFx.fail,
  source: chunkMetadataSaveRequested,
  fn: (request, { error }) => ({
    fileId: request.fileId,
    chunkNumber: request.chunkNumber,
    error
  }),
  target: chunkMetadataSaveFailed
});

sample({
  clock: fileMetadataLoadRequested,
  fn: (fileId) => fileId,
  target: loadFileMetadataFx
});

sample({
  clock: loadFileMetadataFx.doneData,
  target: fileMetadataLoaded
});

sample({
  clock: loadFileMetadataFx.fail,
  source: fileMetadataLoadRequested,
  fn: (fileId, { error }) => ({
    fileId,
    error
  }),
  target: fileMetadataLoadFailed
});

$fileMetadataCache.on(fileMetadataLoaded, (state, metadata) => {
  const newMap = new Map(state);
  newMap.set(metadata.id, metadata);
  return newMap;
});

$files.on(fileMetadataSaveFailed, (state, { fileId, error }) => {
  const file = state.get(fileId);
  if (!file) return state;

  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: 'failed', error: error.message });
  return newMap;
});

$chunks.on(chunkMetadataSaveFailed, (state, { fileId, chunkNumber, error }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk) return state;

  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: 'failed', error: error.message });
  return newMap;
});

$files.on(fileMetadataLoadFailed, (state, { fileId, error }) => {
  const file = state.get(fileId);
  if (!file) return state;

  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: 'failed', error: error.message });
  return newMap;
});

sample({
  clock: chunkLoadRequested,
  target: loadChunkFx
});

sample({
  clock: loadChunkFx.doneData,
  target: chunkLoaded
});