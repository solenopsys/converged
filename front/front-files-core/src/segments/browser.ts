import { sample, combine } from 'effector';

import { type UUID, HashString } from "../../../../types/files";
import { fileTransferDomain } from '../domain';
import { fileChunksLoaded, $fileMetadataCache } from './files';
import { blockSaveRequested, blockSaved } from './store';
import { $files, fileMetadataCreateRequested, } from './files';
import { compressionStarted, chunkPrepared, decompressionStarted, decompressionChunkProcessed, compressionCompleted } from "./streaming"
import { $chunks, fileMetadataLoadRequested, fileMetadataLoaded, chunkMetadataSaveRequested, chunkMetadataSaved, fileChunksLoadRequested } from './files';
import { MAX_PARALLEL_UPLOADS } from "../config"

export const $owner = fileTransferDomain.createStore<string>('anonymous');
export const openFilePicker = fileTransferDomain.createEvent();
export const filesPickerOpened = fileTransferDomain.createEvent<File[]>();
export const fileSelected = fileTransferDomain.createEvent<File>();

export const fileInitialized = fileTransferDomain.createEvent<{
  fileId: UUID;
  file: File;
  owner: string;
}>();

export const uploadChunkRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>();

export const chunkUploadStarted = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>();

export const chunkUploaded = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  hash: HashString;
}>();

export const nextChunkUploadRequested = fileTransferDomain.createEvent<UUID>();

export const uploadCompleted = fileTransferDomain.createEvent<UUID>();

export const retryChunk = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>();

export const pauseUpload = fileTransferDomain.createEvent<UUID>();
export const resumeUpload = fileTransferDomain.createEvent<UUID>();
export const cancelUpload = fileTransferDomain.createEvent<UUID>();

export const downloadRequested = fileTransferDomain.createEvent<UUID>();
export const saveDialogRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  fileName: string;
}>();
export const fileHandleReady = fileTransferDomain.createEvent<{
  fileId: UUID;
  handle: any;
}>();
export const writeChunkRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunk: Uint8Array;
}>();
export const chunkWritten = fileTransferDomain.createEvent<UUID>();

export const clearFileState = fileTransferDomain.createEvent<UUID>();

// Effects - атомарные операции
export const openFilePickerFx = fileTransferDomain.createEffect<void, File[]>(async () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      resolve(files);
    };
    input.click();
  });
});

export const showSaveDialogFx = fileTransferDomain.createEffect<
  { fileName: string },
  any
>(async ({ fileName }) => {
  if ('showSaveFilePicker' in window) {
    return await (window as any).showSaveFilePicker({
      suggestedName: fileName
    });
  }
  return null;
});

export const writeChunkFx = fileTransferDomain.createEffect<
  { handle: any; chunk: Uint8Array },
  void
>(async ({ handle, chunk }) => {
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(chunk);
    await writable.close();
  }
});

// Stores
export const $fileHandles = fileTransferDomain.createStore<Map<UUID, any>>(new Map());

// Logic - File Picker
sample({
  clock: openFilePicker,
  target: openFilePickerFx
});

sample({
  clock: openFilePickerFx.doneData,
  target: filesPickerOpened
});

sample({
  clock: filesPickerOpened,
  fn: (files) => files,
  target: fileSelected
});

// Logic - File Initialization
sample({
  clock: fileSelected,
  source: $owner,
  fn: (owner, file) => ({
    fileId: generateUUID(),
    file,
    owner
  }),
  target: fileInitialized
});

$files.on(fileInitialized, (state, { fileId, file }) => {
  const newMap = new Map(state);
  newMap.set(fileId, {
    fileId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    totalChunks: null,
    status: 'compressing'
  });
  return newMap;
});

sample({
  clock: fileInitialized,
  target: fileMetadataCreateRequested
});

sample({
  clock: fileInitialized,
  fn: ({ fileId, file }) => ({ fileId, file }),
  target: compressionStarted
});

// Logic - Chunk Prepared
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

sample({
  clock: chunkPrepared,
  fn: ({ fileId, chunkNumber }) => ({ fileId, chunkNumber }),
  target: uploadChunkRequested
});

// Logic - Upload Chunk
sample({
  clock: uploadChunkRequested,
  source: $chunks,
  filter: (chunks, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    if (!chunk || chunk.status !== 'prepared') return false;

    const uploading = Array.from(chunks.values())
      .filter(c => c.fileId === fileId && c.status === 'uploading').length;

    return uploading < MAX_PARALLEL_UPLOADS;
  },
  fn: (chunks, { fileId, chunkNumber }) => ({ fileId, chunkNumber }),
  target: chunkUploadStarted
});

$chunks.on(chunkUploadStarted, (state, { fileId, chunkNumber }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk) return state;

  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: 'uploading' });
  return newMap;
});

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

$chunks.on(chunkUploaded, (state, { fileId, chunkNumber, hash }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk) return state;

  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: 'uploaded', hash });
  return newMap;
});

sample({
  clock: chunkUploaded,
  fn: ({ fileId }) => fileId,
  target: nextChunkUploadRequested
});

// Logic - Next Chunk
sample({
  clock: nextChunkUploadRequested,
  source: $chunks,
  filter: (chunks, fileId) => {
    const fileChunks = Array.from(chunks.values()).filter(c => c.fileId === fileId);
    const prepared = fileChunks.filter(c => c.status === 'prepared');
    const uploading = fileChunks.filter(c => c.status === 'uploading').length;
    return prepared.length > 0 && uploading < MAX_PARALLEL_UPLOADS;
  },
  fn: (chunks, fileId) => {
    const prepared = Array.from(chunks.values())
      .filter(c => c.fileId === fileId && c.status === 'prepared')[0];
    return { fileId: prepared.fileId, chunkNumber: prepared.chunkNumber };
  },
  target: uploadChunkRequested
});

// Logic - Upload Completed
sample({
  clock: chunkUploaded,
  source: combine({ chunks: $chunks, files: $files }),
  filter: ({ chunks, files }, { fileId }) => {
    const file = files.get(fileId);
    if (!file?.totalChunks) return false;

    const fileChunks = Array.from(chunks.values()).filter(c => c.fileId === fileId);
    const uploaded = fileChunks.filter(c => c.status === 'uploaded').length;
    return uploaded === file.totalChunks;
  },
  fn: (state, { fileId }) => fileId,
  target: uploadCompleted
});

$files.on(uploadCompleted, (state, fileId) => {
  const file = state.get(fileId);
  if (!file) return state;

  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: 'completed' });
  return newMap;
});

$files.on(compressionCompleted, (state, { fileId, totalChunks }) => {
  const file = state.get(fileId);
  if (!file) return state;

  const newMap = new Map(state);
  newMap.set(fileId, { ...file, totalChunks, status: 'uploading' });
  return newMap;
});

// Logic - Retry
$chunks.on(retryChunk, (state, { fileId, chunkNumber }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk) return state;

  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: 'prepared', error: undefined });
  return newMap;
});

sample({
  clock: retryChunk,
  target: uploadChunkRequested
});

// Logic - Pause/Resume
$files.on(pauseUpload, (state, fileId) => {
  const file = state.get(fileId);
  if (!file) return state;

  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: 'paused' });
  return newMap;
});

$files.on(resumeUpload, (state, fileId) => {
  const file = state.get(fileId);
  if (!file) return state;

  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: 'uploading' });
  return newMap;
});

sample({
  clock: resumeUpload,
  source: $chunks,
  filter: (chunks, fileId) => {
    const prepared = Array.from(chunks.values())
      .filter(c => c.fileId === fileId && c.status === 'prepared');
    return prepared.length > 0;
  },
  fn: (chunks, fileId) => {
    const prepared = Array.from(chunks.values())
      .filter(c => c.fileId === fileId && c.status === 'prepared')
      .slice(0, MAX_PARALLEL_UPLOADS);

    return prepared.map(c => ({ fileId: c.fileId, chunkNumber: c.chunkNumber }));
  },
  target: uploadChunkRequested
});

// Logic - Download
sample({
  clock: downloadRequested,
  target: fileMetadataLoadRequested
});

sample({
  clock: fileMetadataLoaded,
  fn: (metadata) => metadata.id,
  target: fileChunksLoadRequested
});

sample({
  clock: fileChunksLoaded,
  source: $fileMetadataCache,
  fn: (cache, { fileId }) => ({
    fileId,
    fileName: cache.get(fileId)!.name
  }),
  target: saveDialogRequested
});

sample({
  clock: saveDialogRequested,
  fn: ({ fileName }) => ({ fileName }),
  target: showSaveDialogFx
});

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

sample({
  clock: fileHandleReady,
  fn: ({ fileId }) => ({ fileId }),
  target: decompressionStarted
});

sample({
  clock: decompressionChunkProcessed,
  fn: ({ fileId, decompressed }) => ({
    fileId,
    chunk: decompressed
  }),
  target: writeChunkRequested
});

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

// Logic - Clear
$files.on(clearFileState, (state, fileId) => {
  const newMap = new Map(state);
  newMap.delete(fileId);
  return newMap;
});

$chunks.on(clearFileState, (state, fileId) => {
  const newMap = new Map(state);
  Array.from(newMap.keys())
    .filter(key => key.startsWith(fileId))
    .forEach(key => newMap.delete(key));
  return newMap;
});