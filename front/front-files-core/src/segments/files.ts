import {  sample, combine } from 'effector';
import { fileTransferDomain } from "../domain";

import { FilesService, FileMetadata, FileChunk, UUID, HashString } from "../../../../types/files";
export const $filesService = fileTransferDomain.createStore<FilesService | null>(null);

// Types
export type ChunkStatus = 'prepared' | 'uploading' | 'uploaded' | 'failed';

export type ChunkState = {
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;      // СЖАТЫЕ данные (Deflate) - блок 1MB (или меньше для последнего)
  hash?: HashString;     // SHA-256 hash блока (для дедупликации)
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

export const fileMetadataLoadRequested = fileTransferDomain.createEvent<UUID>();

export const fileMetadataLoaded = fileTransferDomain.createEvent<FileMetadata>();

export const fileChunksLoadRequested = fileTransferDomain.createEvent<UUID>();

export const fileChunksLoaded = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunks: FileChunk[];
}>();

export const fileMetadataUpdateRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  updates: Partial<FileMetadata>;
}>();

// Effects - атомарные операции
export const saveFileMetadataFx = fileTransferDomain.createEffect<
  { filesService: FilesService; file: FileMetadata },
  UUID
>(async ({ filesService, file }) => filesService.save(file));

export const saveChunkMetadataFx = fileTransferDomain.createEffect<
  { filesService: FilesService; chunk: FileChunk },
  HashString
>(async ({ filesService, chunk }) => filesService.saveChunk(chunk));

export const loadFileMetadataFx = fileTransferDomain.createEffect<
  { filesService: FilesService; id: UUID },
  FileMetadata
>(async ({ filesService, id }) => filesService.get(id));

export const loadFileChunksFx = fileTransferDomain.createEffect<
  { filesService: FilesService; id: UUID },
  FileChunk[]
>(async ({ filesService, id }) => filesService.getChunks(id));

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
  source: $filesService,
  filter: (service) => service !== null,
  fn: (service, { fileId, file, owner }) => ({
    filesService: service!,
    file: {
      id: fileId,
      hash: '',
      status: 'uploading' as const,
      name: file.name,
      fileSize: file.size,
      fileType: file.type,
      compression: 'deflate',  // Deflate (без gzip заголовков) - экономия либы и overhead
      owner,
      createdAt: new Date().toISOString(),
      chunksCount: 0
    }
  }),
  target: saveFileMetadataFx
});

sample({
  clock: saveFileMetadataFx.doneData,
  target: fileMetadataCreated
});

sample({
  clock: chunkMetadataSaveRequested,
  source: $filesService,
  filter: (service) => service !== null,
  fn: (service, { fileId, chunkNumber, hash, chunkSize }) => ({
    filesService: service!,
    chunk: {
      fileId,
      hash,
      chunkNumber,
      chunkSize,
      createdAt: new Date().toISOString()
    }
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
  clock: fileMetadataLoadRequested,
  source: $filesService,
  filter: (service) => service !== null,
  fn: (service, fileId) => ({ filesService: service!, id: fileId }),
  target: loadFileMetadataFx
});

sample({
  clock: loadFileMetadataFx.doneData,
  target: fileMetadataLoaded
});

$fileMetadataCache.on(fileMetadataLoaded, (state, metadata) => {
  const newMap = new Map(state);
  newMap.set(metadata.id, metadata);
  return newMap;
});

sample({
  clock: fileChunksLoadRequested,
  source: $filesService,
  filter: (service) => service !== null,
  fn: (service, fileId) => ({ filesService: service!, id: fileId }),
  target: loadFileChunksFx
});

sample({
  clock: loadFileChunksFx.doneData,
  source: fileChunksLoadRequested,
  fn: (fileId, chunks) => ({ fileId, chunks }),
  target: fileChunksLoaded
});
