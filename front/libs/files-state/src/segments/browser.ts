import { sample, combine } from 'effector';
import { type UUID, HashString } from "../../../../../types/files";
import { fileTransferDomain } from '../domain';
import { $files, $chunks, $fileMetadataCache } from './files';
import { MAX_PARALLEL_UPLOADS, MAX_RETRY_ATTEMPTS } from '../config';

function generateUUID(): UUID {
  return crypto.randomUUID() as UUID;
}

export const $owner = fileTransferDomain.createStore<string>('anonymous', { name: 'OWNER' });
export const openFilePicker = fileTransferDomain.createEvent('OPEN_FILE_PICKER');
export const filesPickerOpened = fileTransferDomain.createEvent<File[]>('FILES_PICKER_OPENED');
export const fileSelected = fileTransferDomain.createEvent<File>('FILE_SELECTED');

export const fileInitialized = fileTransferDomain.createEvent<{
  fileId: UUID;
  file: File;
  owner: string;
}>('FILE_INITIALIZED');

export const uploadChunkRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>('UPLOAD_CHUNK_REQUESTED');

export const chunkUploadStarted = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>('CHUNK_UPLOAD_STARTED');

export const chunkUploaded = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  hash: HashString;
}>('CHUNK_UPLOADED');

export const chunkUploadFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  error: Error;
}>('CHUNK_UPLOAD_FAILED');
export const nextChunkUploadRequested = fileTransferDomain.createEvent<UUID>('NEXT_CHUNK_UPLOAD_REQUESTED');
export const uploadCompleted = fileTransferDomain.createEvent<UUID>('UPLOAD_COMPLETED');

export const retryChunk = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
}>('RETRY_CHUNK');

export const pauseUpload = fileTransferDomain.createEvent<UUID>('PAUSE_UPLOAD');
export const resumeUpload = fileTransferDomain.createEvent<UUID>('RESUME_UPLOAD');
export const cancelUpload = fileTransferDomain.createEvent<UUID>('CANCEL_UPLOAD');

export const downloadRequested = fileTransferDomain.createEvent<UUID>('DOWNLOAD_REQUESTED');
export const saveDialogRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  fileName: string;
}>('SAVE_DIALOG_REQUESTED');
export const fileHandleReady = fileTransferDomain.createEvent<{
  fileId: UUID;
  handle: any;
}>('FILE_HANDLE_READY');
export const writeChunkRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunk: Uint8Array;
}>('WRITE_CHUNK_REQUESTED');
export const chunkWritten = fileTransferDomain.createEvent<UUID>('CHUNK_WRITTEN');

export const clearFileState = fileTransferDomain.createEvent<UUID>('CLEAR_FILE_STATE');

// Effects
export const openFilePickerFx = fileTransferDomain.createEffect<void, File[]>('OPEN_FILE_PICKER_FX');
openFilePickerFx.use(async () => {
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
>('SHOW_SAVE_DIALOG_FX');
showSaveDialogFx.use(async ({ fileName }) => {
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
>('WRITE_CHUNK_FX');
writeChunkFx.use(async ({ handle, chunk }) => {
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(chunk);
    await writable.close();
  }
});

export const retryChunkFx = fileTransferDomain.createEffect<
  { fileId: UUID; chunkNumber: number; retryCount: number },
  { fileId: UUID; chunkNumber: number }
>('RETRY_CHUNK_FX');
retryChunkFx.use(async ({ fileId, chunkNumber, retryCount }) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ fileId, chunkNumber });
    }, 1000 * (retryCount + 1));
  });
});

// Stores
export const $fileHandles = fileTransferDomain.createStore<Map<UUID, any>>(new Map(), { name: 'FILE_HANDLES' });

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

$chunks.on(chunkUploaded, (state, { fileId, chunkNumber, hash }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk) return state;

  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: 'uploaded', hash });
  return newMap;
});

$chunks.on(chunkUploadFailed, (state, { fileId, chunkNumber, error }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk) return state;

  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: 'failed', error: error.message, retryCount: chunk.retryCount + 1 });
  return newMap;
});

sample({
  clock: chunkUploadFailed,
  source: $chunks,
  filter: (chunks, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    return chunk !== undefined && chunk.retryCount < MAX_RETRY_ATTEMPTS;
  },
  fn: (chunks, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key)!;
    return { fileId, chunkNumber, retryCount: chunk.retryCount };
  },
  target: retryChunkFx
});

sample({
  clock: retryChunkFx.doneData,
  target: retryChunk
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