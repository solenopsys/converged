import { sample, combine } from 'effector';
import { fileTransferDomain } from "../domain";
import { FileMetadata, FileChunk, UUID, HashString } from "../../../../../types/files";
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
}>('FILE_METADATA_CREATE_REQUESTED');

export const fileMetadataCreated = fileTransferDomain.createEvent<UUID>('FILE_METADATA_CREATED');

export const fileMetadataSaveFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  error: Error;
}>('FILE_METADATA_SAVE_FAILED');

export const chunkMetadataSaveRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  hash: HashString;
  chunkSize: number;
}>('CHUNK_METADATA_SAVE_REQUESTED');

export const chunkMetadataSaved = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>('CHUNK_METADATA_SAVED');

export const chunkMetadataSaveFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  error: Error;
}>('CHUNK_METADATA_SAVE_FAILED');

export const fileMetadataLoadRequested = fileTransferDomain.createEvent<UUID>('FILE_METADATA_LOAD_REQUESTED');

export const fileMetadataLoaded = fileTransferDomain.createEvent<FileMetadata>('FILE_METADATA_LOADED');

export const fileMetadataLoadFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  error: Error;
}>('FILE_METADATA_LOAD_FAILED');

export const chunkLoadRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>('CHUNK_LOAD_REQUESTED');

export const chunkLoaded = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>('CHUNK_LOADED');

// Effects
export const saveFileMetadataFx = fileTransferDomain.createEffect<
  FileMetadata,
  UUID
>('SAVE_FILE_METADATA_FX');
saveFileMetadataFx.use(async (file) => services.filesService.save(file));

export const saveChunkMetadataFx = fileTransferDomain.createEffect<
  FileChunk,
  HashString
>('SAVE_CHUNK_METADATA_FX');
saveChunkMetadataFx.use(async (chunk) => services.filesService.saveChunk(chunk));

export const loadFileMetadataFx = fileTransferDomain.createEffect<
  UUID,
  FileMetadata
>('LOAD_FILE_METADATA_FX');
loadFileMetadataFx.use(async (id) => services.filesService.get(id));

export const loadChunkFx = fileTransferDomain.createEffect<
  { fileId: UUID; chunkNumber: number },
  { fileId: UUID; chunkNumber: number; data: Uint8Array }
>('LOAD_CHUNK_FX');
loadChunkFx.use(async ({ fileId, chunkNumber }) => {
  // This is a placeholder for the actual implementation of loading a single chunk.
  // In a real application, this would make a request to the server to get the chunk data.
  const data = new Uint8Array(0);
  return { fileId, chunkNumber, data };
});

// Stores
export const $files = fileTransferDomain.createStore<Map<UUID, FileUploadState>>(new Map(), { name: 'FILES' });
export const $chunks = fileTransferDomain.createStore<Map<string, ChunkState>>(new Map(), { name: 'CHUNKS' });
export const $fileMetadataCache = fileTransferDomain.createStore<Map<UUID, FileMetadata>>(new Map(), { name: 'FILE_METADATA_CACHE' });

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

// Use effect.done to ensure we pair the result with the exact params
sample({
  clock: saveChunkMetadataFx.done,
  fn: ({ params }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber
  }),
  target: chunkMetadataSaved
});

sample({
  clock: saveChunkMetadataFx.fail,
  fn: ({ params, error }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
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