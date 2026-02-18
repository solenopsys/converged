import { sample, combine } from 'effector';
import { type UUID, type  HashString } from "../../../../../types/files";
import { fileTransferDomain } from '../domain';
import { $files, $chunks, $fileMetadataCache } from './files';
import { MAX_PARALLEL_UPLOADS, MAX_RETRY_ATTEMPTS, calculateTotalChunks } from '../config';
import { services } from '../services';

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

export const downloadRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  fileName?: string;
}>('DOWNLOAD_REQUESTED');
export const saveDialogRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  fileName: string;
}>('SAVE_DIALOG_REQUESTED');
export const downloadCancelled = fileTransferDomain.createEvent<UUID>('DOWNLOAD_CANCELLED');
export const downloadBufferAppended = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunk: Uint8Array;
}>('DOWNLOAD_BUFFER_APPENDED');
export const downloadBufferCleared = fileTransferDomain.createEvent<UUID>('DOWNLOAD_BUFFER_CLEARED');
export const downloadOffsetAdvanced = fileTransferDomain.createEvent<{
  fileId: UUID;
  offset: number;
}>('DOWNLOAD_OFFSET_ADVANCED');
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

export type DownloadMode = 'file' | 'buffer' | 'cancelled';

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
  const hasFileSystemAPI = 'showSaveFilePicker' in window;
  console.log('[Browser] showSaveDialogFx:', {
    fileName,
    hasFileSystemAPI,
    browser: navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other'
  });

  if (hasFileSystemAPI) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName
      });
      console.log('[Browser] File handle obtained via showSaveFilePicker');
      return handle;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('[Browser] User cancelled save dialog');
        throw error;
      }
      console.error('[Browser] showSaveFilePicker failed:', error);
      return null;
    }
  }

  console.log('[Browser] File System Access API not supported, using buffer mode');
  return null;
});

export const writeChunkFx = fileTransferDomain.createEffect<
  { fileId: UUID; handle: any; chunk: Uint8Array; position: number },
  void
>('WRITE_CHUNK_FX');
writeChunkFx.use(async ({ handle, chunk, position }) => {
  if (handle) {
    const writable = await handle.createWritable({ keepExistingData: true });
    await writable.write({ type: 'write', position, data: chunk });
    await writable.close();
  }
});

export const downloadFileFx = fileTransferDomain.createEffect<
  { fileId: UUID; fileName?: string },
  void
>('DOWNLOAD_FILE_FX');
downloadFileFx.use(async ({ fileId, fileName }) => {
  console.log('[Browser] downloadFileFx called:', { fileId, fileName });

  const { downloadFile } = await import('../download');

  const filesService = services.getFilesService();
  const storeService = services.getStoreService();

  if (!filesService || !storeService) {
    console.error('[Browser] Services not initialized');
    throw new Error('Services not initialized');
  }

  console.log('[Browser] Starting download...');
  const result = await downloadFile(fileId, filesService, storeService);

  // Если blob пустой, значит файл уже записан через File System Access API
  if (result.blob.size === 0) {
    console.log('[Browser] File already written via File System Access API');
    return;
  }

  // Fallback: используем blob URL для скачивания
  console.log('[Browser] Download complete, creating blob URL');
  const url = URL.createObjectURL(result.blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || result.fileName;
  document.body.appendChild(link);

  console.log('[Browser] Triggering download click for:', link.download);
  link.click();

  setTimeout(() => {
    console.log('[Browser] Cleaning up blob URL and link');
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 1000);

  console.log('[Browser] Download initiated successfully');
});

export const downloadBufferedFileFx = fileTransferDomain.createEffect<
  { fileId: UUID; fileName: string; chunks: Uint8Array[] },
  void
>('DOWNLOAD_BUFFERED_FILE_FX');
downloadBufferedFileFx.use(async ({ fileName, chunks }) => {
  console.log('[Browser] downloadBufferedFileFx called:', {
    fileName,
    chunksCount: chunks.length,
    totalSize: chunks.reduce((sum, c) => sum + c.length, 0)
  });

  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    console.error('[Browser] Browser APIs not available');
    return;
  }

  if (!chunks || chunks.length === 0) {
    console.error('[Browser] No chunks to download');
    return;
  }

  try {
    const blob = new Blob(chunks as BlobPart[]);
    console.log('[Browser] Blob created:', { size: blob.size, type: blob.type });

    const url = URL.createObjectURL(blob);
    console.log('[Browser] Blob URL created:', url);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    // Важно: не скрываем элемент, в некоторых браузерах это блокирует скачивание
    document.body.appendChild(link);

    console.log('[Browser] Triggering download click for:', fileName);
    link.click();

    // Даем браузеру время начать загрузку перед очисткой
    setTimeout(() => {
      console.log('[Browser] Cleaning up blob URL and link');
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 1000);

    console.log('[Browser] Download initiated successfully');
  } catch (error) {
    console.error('[Browser] Download failed:', error);
    throw error;
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
export const $downloadMode = fileTransferDomain.createStore<Map<UUID, DownloadMode>>(new Map(), { name: 'DOWNLOAD_MODE' });
export const $downloadBuffers = fileTransferDomain.createStore<Map<UUID, Uint8Array[]>>(new Map(), { name: 'DOWNLOAD_BUFFERS' });
export const $downloadOffsets = fileTransferDomain.createStore<Map<UUID, number>>(new Map(), { name: 'DOWNLOAD_OFFSETS' });

$downloadMode
  .on(downloadRequested, (state, { fileId }) => {
    console.log('[Browser] downloadRequested - clearing mode for:', fileId);
    const newMap = new Map(state);
    newMap.delete(fileId);
    return newMap;
  })
  .on(fileHandleReady, (state, { fileId, handle }) => {
    const mode = handle ? 'file' : 'buffer';
    console.log('[Browser] fileHandleReady - setting mode:', { fileId, handle: !!handle, mode });
    const newMap = new Map(state);
    newMap.set(fileId, mode);
    return newMap;
  })
  .on(downloadCancelled, (state, fileId) => {
    console.log('[Browser] downloadCancelled:', fileId);
    const newMap = new Map(state);
    newMap.set(fileId, 'cancelled');
    return newMap;
  });

$downloadBuffers
  .on(downloadRequested, (state, { fileId }) => {
    console.log('[Browser] downloadRequested - clearing buffer for:', fileId);
    const newMap = new Map(state);
    newMap.delete(fileId);
    return newMap;
  })
  .on(downloadBufferAppended, (state, { fileId, chunk }) => {
    const newMap = new Map(state);
    const existing = newMap.get(fileId) ?? [];
    const updated = [...existing, new Uint8Array(chunk)];
    console.log('[Browser] downloadBufferAppended:', {
      fileId,
      chunkSize: chunk.length,
      totalChunks: updated.length,
      totalBytes: updated.reduce((sum, c) => sum + c.length, 0)
    });
    newMap.set(fileId, updated);
    return newMap;
  })
  .on(downloadBufferCleared, (state, fileId) => {
    console.log('[Browser] downloadBufferCleared:', fileId);
    const newMap = new Map(state);
    newMap.delete(fileId);
    return newMap;
  });

$downloadOffsets
  .on(downloadRequested, (state, { fileId }) => {
    const newMap = new Map(state);
    newMap.delete(fileId);
    return newMap;
  })
  .on(downloadCancelled, (state, fileId) => {
    const newMap = new Map(state);
    newMap.delete(fileId);
    return newMap;
  })
  .on(downloadOffsetAdvanced, (state, { fileId, offset }) => {
    const newMap = new Map(state);
    newMap.set(fileId, offset);
    return newMap;
  });

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
  fn: (files) => files[0],
  filter: (files) => files.length > 0,
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
  const totalChunks = calculateTotalChunks(file.size);
  const newMap = new Map(state);
  newMap.set(fileId, {
    fileId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    totalChunks,
    uploadedChunks: 0,
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
    if (!chunk || chunk.status !== 'prepared') {
      console.log(`[Browser] uploadChunkRequested BLOCKED: chunk=${chunkNumber}, exists=${!!chunk}, status=${chunk?.status}`);
      return false;
    }

    const uploading = Array.from(chunks.values())
      .filter(c => c.fileId === fileId && c.status === 'uploading').length;

    const result = uploading < MAX_PARALLEL_UPLOADS;
    console.log(`[Browser] uploadChunkRequested: chunk=${chunkNumber}, uploading=${uploading}, maxParallel=${MAX_PARALLEL_UPLOADS}, pass=${result}`);
    return result;
  },
  fn: (chunks, { fileId, chunkNumber }) => {
    console.log(`[Browser] -> chunkUploadStarted: chunk=${chunkNumber}`);
    return { fileId, chunkNumber };
  },
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

// Увеличиваем uploadedChunks в файле при каждом chunkUploaded
$files.on(chunkUploaded, (state, { fileId }) => {
  const file = state.get(fileId);
  if (!file) return state;

  const newMap = new Map(state);
  newMap.set(fileId, { ...file, uploadedChunks: file.uploadedChunks + 1 });
  return newMap;
});

$chunks.on(chunkUploadFailed, (state, { fileId, chunkNumber, error }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  console.log(`[Browser] chunkUploadFailed: chunk=${chunkNumber}, error=${error.message}, retryCount=${chunk?.retryCount}`);
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
  source: $files,
  filter: (files, { fileId }) => {
    const file = files.get(fileId);
    if (!file?.totalChunks) return false;

    return file.uploadedChunks === file.totalChunks;
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

// При resume запускаем загрузку через очередь
sample({
  clock: resumeUpload,
  fn: (fileId) => fileId,
  target: nextChunkUploadRequested
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

// Logic - Download
sample({
  clock: downloadRequested,
  fn: ({ fileId, fileName }) => {
    console.log('[Browser] downloadRequested -> downloadFileFx:', { fileId, fileName });
    return { fileId, fileName };
  },
  target: downloadFileFx
});
