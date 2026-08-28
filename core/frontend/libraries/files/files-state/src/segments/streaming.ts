import { sample } from 'effector';
import type { UUID } from '../../../../../types/files';
import {
  UploadWorkerCommandType,
  UploadWorkerEventType,
  type UploadWorkerOutgoingMessage,
} from '../../../store-workers/src/types';

export {
  compressionStarted,
  chunkPrepared,
  compressionCompleted,
  compressionFailed,
  decompressionStarted,
  decompressionStateInitialized,
  decompressionFailed,
  decompressionChunkRequested,
  decompressionDataReceived,
  decompressionChunkProcessed,
  decompressionCompleted,
  chunkConsumed,
  $decompressionState,
} from './streaming-core';

import {
  compressionStarted,
  chunkPrepared,
  compressionCompleted,
  compressionFailed,
} from './streaming-core';

// STORE-WORKERS INTEGRATION

let storeWorker: Worker | null = null;

export function setStoreWorker(worker: Worker) {
  if (storeWorker) {
    console.warn('[Streaming] Replacing existing worker');
    storeWorker.terminate();
  }
  storeWorker = worker;
  setupWorkerHandlers(worker);
}

function getStoreWorker(): Worker {
  if (!storeWorker) {
    throw new Error('[files-state] store worker is not configured: call setStoreWorker first');
  }
  return storeWorker;
}

// UPLOAD WORKER MESSAGE HANDLERS

import { blockSaved } from './store';

function setupWorkerHandlers(worker: Worker) {
  worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
    const message = event.data;

    switch (message.type) {
      case UploadWorkerEventType.ChunkPrepared:
        chunkPrepared({
          fileId: message.fileId,
          chunkNumber: message.chunkNumber,
          dataRef: message.dataRef,
          originalSize: message.originalSize,
          compression: message.compression,
        });
        break;

      case UploadWorkerEventType.FileUploaded:
        compressionCompleted({
          fileId: message.fileId,
          totalChunks: message.totalChunks,
        });
        break;

      case UploadWorkerEventType.Error:
        console.error('[Streaming] Upload error:', message);
        compressionFailed({
          fileId: message.fileId,
          error: message.error,
        });
        break;

      case UploadWorkerEventType.Progress:

        break;
    }
  };

  worker.onerror = (error) => {
    console.error('[Streaming] Worker error:', error);
  };
}

// UPLOAD LOGIC

sample({
  clock: compressionStarted,
  fn: ({ fileId, file }) => {
    const message: any = {
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    };

    const worker = getStoreWorker();
    worker.postMessage(message);
  },
});

blockSaved.watch(({ fileId, chunkNumber }) => {
	storeWorker?.postMessage({
		type: UploadWorkerCommandType.ChunkConsumed,
		fileId,
		chunkNumber,
	});
});

// CLEANUP

export function terminateWorkers() {
  if (storeWorker) {
    storeWorker.terminate();
    storeWorker = null;
  }
}
