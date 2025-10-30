import { fileTransferDomain } from '../domain';
import type { UUID, HashString } from '../../../../../types/files';
import { services } from '../services';
import {
  DownloadWorkerCommandType,
  DownloadWorkerEventType,
  type DownloadWorkerOutgoingMessage,
  type UploadWorkerOutgoingMessage,
  UploadWorkerCommandType,
  UploadWorkerEventType,
} from '../../store-workers/src/types';

const workerScriptUrl = new URL('../../store-workers/dist/store.worker.js', import.meta.url);

type UploadWorkerRequest = {
  fileId: UUID;
  file: File;
};

type DownloadWorkerRequest = {
  fileId: UUID;
  chunks: readonly HashString[];
  destination: WritableStream<Uint8Array> | MessagePort;
  transfer?: Transferable[];
};

const uploadWorkers = new Map<UUID, Worker>();
const downloadWorkers = new Map<UUID, Worker>();

function createStoreWorker() {
  return new Worker(workerScriptUrl, { type: 'module', name: 'store-worker' });
}

function cleanupWorker(map: Map<UUID, Worker>, fileId: UUID) {
  const worker = map.get(fileId);
  if (!worker) return;
  worker.terminate();
  map.delete(fileId);
}

export const uploadWorkerRequested = fileTransferDomain.createEvent<UploadWorkerRequest>('UPLOAD_WORKER_REQUESTED');
export const uploadWorkerCommandRequested = fileTransferDomain.createEvent<{ fileId: UUID; command: UploadWorkerCommandType }>('UPLOAD_WORKER_COMMAND_REQUESTED');
export const uploadWorkerProgress = fileTransferDomain.createEvent<{ fileId: UUID; bytesProcessed: number; totalBytes: number }>('UPLOAD_WORKER_PROGRESS');
export const uploadWorkerChunkStored = fileTransferDomain.createEvent<{ fileId: UUID; chunkNumber: number; hash: HashString; chunkSize: number }>('UPLOAD_WORKER_CHUNK_STORED');
export const uploadWorkerCompleted = fileTransferDomain.createEvent<{ fileId: UUID; totalChunks: number }>('UPLOAD_WORKER_COMPLETED');
export const uploadWorkerFailed = fileTransferDomain.createEvent<{ fileId: UUID; error: string; chunkNumber?: number }>('UPLOAD_WORKER_FAILED');

export const downloadWorkerRequested = fileTransferDomain.createEvent<DownloadWorkerRequest>('DOWNLOAD_WORKER_REQUESTED');
export const downloadWorkerProgress = fileTransferDomain.createEvent<{ fileId: UUID; chunkNumber: number; totalChunks: number }>('DOWNLOAD_WORKER_PROGRESS');
export const downloadWorkerCompleted = fileTransferDomain.createEvent<{ fileId: UUID }>('DOWNLOAD_WORKER_COMPLETED');
export const downloadWorkerFailed = fileTransferDomain.createEvent<{ fileId: UUID; error: string }>('DOWNLOAD_WORKER_FAILED');

const startUploadWorkerFx = fileTransferDomain.createEffect<UploadWorkerRequest, void>('UPLOAD_WORKER_START_FX');
startUploadWorkerFx.use(async ({ fileId, file }) => {
  cleanupWorker(uploadWorkers, fileId);
  const worker = createStoreWorker();
  uploadWorkers.set(fileId, worker);

  worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
    const message = event.data;
    switch (message.type) {
      case UploadWorkerEventType.ChunkReady:
        uploadWorkerChunkStored({ fileId, chunkNumber: message.chunkNumber, hash: message.hash, chunkSize: message.chunkSize });
        break;
      case UploadWorkerEventType.Progress:
        uploadWorkerProgress({ fileId, bytesProcessed: message.bytesProcessed, totalBytes: message.totalBytes });
        break;
      case UploadWorkerEventType.FileUploaded:
        uploadWorkerCompleted({ fileId, totalChunks: message.totalChunks });
        cleanupWorker(uploadWorkers, fileId);
        break;
      case UploadWorkerEventType.Error:
        uploadWorkerFailed({ fileId, error: message.error, chunkNumber: message.chunkNumber });
        cleanupWorker(uploadWorkers, fileId);
        break;
    }
  };

  worker.onerror = (error) => {
    uploadWorkerFailed({ fileId, error: error.message || 'Worker error' });
    cleanupWorker(uploadWorkers, fileId);
  };

  const storeOptions = services.storeWorkerOptions ?? undefined;

  worker.postMessage({
    type: UploadWorkerCommandType.UploadStart,
    fileId,
    file,
    store: storeOptions,
  });
});

uploadWorkerRequested.watch((payload) => {
  startUploadWorkerFx(payload);
});

uploadWorkerCommandRequested.watch(({ fileId, command }) => {
  const worker = uploadWorkers.get(fileId);
  if (!worker) return;
  worker.postMessage({ type: command, fileId });
  if (command === UploadWorkerCommandType.Cancel) {
    cleanupWorker(uploadWorkers, fileId);
  }
});

const startDownloadWorkerFx = fileTransferDomain.createEffect<DownloadWorkerRequest, void>('DOWNLOAD_WORKER_START_FX');
startDownloadWorkerFx.use(async ({ fileId, chunks, destination, transfer }) => {
  cleanupWorker(downloadWorkers, fileId);
  const worker = createStoreWorker();
  downloadWorkers.set(fileId, worker);

  worker.onmessage = (event: MessageEvent<DownloadWorkerOutgoingMessage>) => {
    const message = event.data;
    switch (message.type) {
      case DownloadWorkerEventType.Chunk:
        downloadWorkerProgress({ fileId, chunkNumber: message.chunkNumber, totalChunks: message.totalChunks ?? chunks.length });
        break;
      case DownloadWorkerEventType.FileDownloaded:
        downloadWorkerCompleted({ fileId });
        cleanupWorker(downloadWorkers, fileId);
        break;
      case DownloadWorkerEventType.Error:
        downloadWorkerFailed({ fileId, error: message.error });
        cleanupWorker(downloadWorkers, fileId);
        break;
    }
  };

  worker.onerror = (error) => {
    downloadWorkerFailed({ fileId, error: error.message || 'Worker error' });
    cleanupWorker(downloadWorkers, fileId);
  };

  const transferList = transfer ?? (destination instanceof MessagePort ? [destination] : undefined);

  worker.postMessage(
    {
      type: DownloadWorkerCommandType.DownloadStart,
      fileId,
      chunks,
      destination,
    },
    transferList,
  );
});

downloadWorkerRequested.watch((payload) => {
  startDownloadWorkerFx(payload);
});
