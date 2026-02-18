import { sample, combine } from 'effector';
import { fileTransferDomain } from "../domain";
import type { FileMetadata, FileChunk, UUID, HashString } from "../../../../../types/files";
import { services } from "../services";

// Types
export type ChunkStatus = 'prepared' | 'uploading' | 'uploaded' | 'failed';

export type ChunkState = {
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
  hash?: HashString;
  originalSize: number;
  compression: 'none' | 'deflate';
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
  uploadedChunks: number;
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

export const fileMetadataUpdateRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  patch: Partial<FileMetadata>;
}>('FILE_METADATA_UPDATE_REQUESTED');

export const fileMetadataUpdated = fileTransferDomain.createEvent<FileMetadata>('FILE_METADATA_UPDATED');

export const fileMetadataUpdateFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  error: Error;
}>('FILE_METADATA_UPDATE_FAILED');

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

export const fileChunksLoadRequested = fileTransferDomain.createEvent<UUID>('FILE_CHUNKS_LOAD_REQUESTED');

export const fileChunksLoaded = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunks: FileChunk[];
}>('FILE_CHUNKS_LOADED');

export const fileChunksLoadFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  error: Error;
}>('FILE_CHUNKS_LOAD_FAILED');

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

export const updateFileMetadataFx = fileTransferDomain.createEffect<
  FileMetadata,
  void
>('UPDATE_FILE_METADATA_FX');
updateFileMetadataFx.use(async (file) => services.filesService.update(file.id, file));

export const saveChunkMetadataFx = fileTransferDomain.createEffect<
  FileChunk,
  HashString
>('SAVE_CHUNK_METADATA_FX');
saveChunkMetadataFx.use(async (chunk) => {
  console.log('[saveChunkMetadataFx] Calling filesService.saveChunk with:', JSON.stringify(chunk));
  const result = await services.filesService.saveChunk(chunk);
  console.log('[saveChunkMetadataFx] Result:', result);
  return result;
});

export const loadFileMetadataFx = fileTransferDomain.createEffect<
  UUID,
  FileMetadata
>('LOAD_FILE_METADATA_FX');
loadFileMetadataFx.use(async (id) => {
  console.log('[loadFileMetadataFx] Loading metadata for fileId:', id);
  const result = await services.filesService.get(id);
  console.log('[loadFileMetadataFx] Result:', result);
  return result;
});

export const loadFileChunksFx = fileTransferDomain.createEffect<
  UUID,
  FileChunk[]
>('LOAD_FILE_CHUNKS_FX');
loadFileChunksFx.use(async (id) => {
  console.log('[loadFileChunksFx] Loading chunks for fileId:', id);
  const result = await services.filesService.getChunks(id);
  console.log('[loadFileChunksFx] Result:', result.length, 'chunks');
  return result;
});

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
export const $fileChunksCache = fileTransferDomain.createStore<Map<UUID, FileChunk[]>>(new Map(), { name: 'FILE_CHUNKS_CACHE' });

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
const buildFileMetadata = ({ fileId, file, owner }: { fileId: UUID; file: File; owner: string }): FileMetadata => ({
  id: fileId,
  hash: '',
  status: 'uploading',
  name: file.name,
  fileSize: file.size,
  fileType: file.type,
  compression: 'deflate',
  owner,
  createdAt: new Date().toISOString(),
  chunksCount: 0
});

sample({
  clock: fileMetadataCreateRequested,
  fn: buildFileMetadata,
  target: saveFileMetadataFx
});

$fileMetadataCache.on(fileMetadataCreateRequested, (state, request) => {
  const newMap = new Map(state);
  newMap.set(request.fileId, buildFileMetadata(request));
  return newMap;
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
  clock: fileMetadataUpdateRequested,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => cache.has(fileId),
  fn: (cache, { fileId, patch }) => ({
    ...cache.get(fileId)!,
    ...patch
  }),
  target: updateFileMetadataFx
});

sample({
  clock: fileMetadataUpdateRequested,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => !cache.has(fileId),
  fn: (_, { fileId }) => ({
    fileId,
    error: new Error(`File metadata not found for ${fileId}`)
  }),
  target: fileMetadataUpdateFailed
});

sample({
  clock: updateFileMetadataFx.done,
  fn: ({ params }) => params,
  target: fileMetadataUpdated
});

sample({
  clock: updateFileMetadataFx.fail,
  source: fileMetadataUpdateRequested,
  fn: ({ fileId }, { error }) => ({
    fileId,
    error
  }),
  target: fileMetadataUpdateFailed
});

sample({
  clock: chunkMetadataSaveRequested,
  fn: ({ fileId, chunkNumber, hash, chunkSize }) => {
    const chunk = {
      fileId,
      hash,
      chunkNumber,
      chunkSize,
      createdAt: new Date().toISOString()
    };
    console.log('[files.ts] chunkMetadataSaveRequested -> saveChunkMetadataFx:', JSON.stringify(chunk));
    return chunk;
  },
  target: saveChunkMetadataFx
});

// Use effect.done to ensure we pair the result with the exact params
sample({
  clock: saveChunkMetadataFx.done,
  fn: ({ params }) => {
    const event = {
      fileId: params.fileId,
      chunkNumber: params.chunkNumber
    };
    console.log('[files.ts] saveChunkMetadataFx.done -> chunkMetadataSaved:', JSON.stringify(event));
    return event;
  },
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

sample({
  clock: fileChunksLoadRequested,
  fn: (fileId) => fileId,
  target: loadFileChunksFx
});

sample({
  clock: loadFileChunksFx.done,
  fn: ({ params, result }) => ({
    fileId: params,
    chunks: result
  }),
  target: fileChunksLoaded
});

sample({
  clock: loadFileChunksFx.fail,
  source: fileChunksLoadRequested,
  fn: (fileId, { error }) => ({
    fileId,
    error
  }),
  target: fileChunksLoadFailed
});

$fileMetadataCache.on(fileMetadataLoaded, (state, metadata) => {
  const newMap = new Map(state);
  newMap.set(metadata.id, metadata);
  return newMap;
});

$fileMetadataCache.on(fileMetadataUpdated, (state, metadata) => {
  const newMap = new Map(state);
  newMap.set(metadata.id, metadata);
  return newMap;
});

$fileChunksCache.on(fileChunksLoaded, (state, { fileId, chunks }) => {
  const newMap = new Map(state);
  newMap.set(fileId, chunks);
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
