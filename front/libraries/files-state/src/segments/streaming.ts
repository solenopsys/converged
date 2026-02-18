// segments/streaming.ts - подключение store-workers к files-state
import { sample } from 'effector';
import type { UUID } from '../../../../../types/files';
import {
  UploadWorkerCommandType,
  UploadWorkerEventType,
  type UploadWorkerOutgoingMessage,
} from '../../../store-workers/src/types';

// Реэкспорт из core
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

// ==========================================
// STORE-WORKERS INTEGRATION
// ==========================================

// Глобальная переменная для worker (может быть установлена извне)
let storeWorker: Worker | null = null;
let storeConfig: any = null;

// Функция для установки кастомного worker (для виджетов и т.д.)
export function setStoreWorker(worker: Worker, config?: any) {
  if (storeWorker) {
    console.warn('[Streaming] Replacing existing worker');
    storeWorker.terminate();
  }
  storeWorker = worker;
  storeConfig = config || null;
  setupWorkerHandlers(worker);
  console.log('[Streaming] Custom worker set', config ? 'with config' : '');
}

// Получение worker (ленивая инициализация)
function getStoreWorker(): Worker {
  if (!storeWorker) {
    console.log('[Streaming] Initializing default store-worker...');
    // Динамический импорт для vite
    const workerUrl = new URL('../../../store-workers/dist/store.worker.js', import.meta.url);
    storeWorker = new Worker(workerUrl, { type: 'module' });
    setupWorkerHandlers(storeWorker);
    console.log('[Streaming] Default store worker initialized');
  }
  return storeWorker;
}

// ==========================================
// UPLOAD WORKER MESSAGE HANDLERS
// ==========================================

import { blockSaved } from './store';

function setupWorkerHandlers(worker: Worker) {
  worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
    const message = event.data;

    console.log('[Streaming] Worker message:', message.type, message);

    switch (message.type) {
      case UploadWorkerEventType.ChunkReady:
        console.log('[Streaming] ChunkReady event:', {
          fileId: message.fileId,
          chunkNumber: message.chunkNumber,
          chunkSize: message.chunkSize,
          hash: message.hash,
        });

        // Пропускаем пустые чанки (баг в worker или race condition)
        if (message.chunkSize === 0) {
          console.warn('[Streaming] Skipping empty chunk:', message.chunkNumber);
          break;
        }

        // Воркер уже сохранил блок, просто триггерим события
        blockSaved({
          fileId: message.fileId,
          chunkNumber: message.chunkNumber,
          hash: message.hash,
          chunkSize: message.chunkSize,
        });
        break;

      case UploadWorkerEventType.FileUploaded:
        console.log('[Streaming] FileUploaded event:', {
          fileId: message.fileId,
          totalChunks: message.totalChunks,
        });
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
        console.log('[Streaming] Upload progress:', {
          fileId: message.fileId,
          bytesProcessed: message.bytesProcessed,
          totalBytes: message.totalBytes,
          percentage: ((message.bytesProcessed / message.totalBytes) * 100).toFixed(2) + '%',
        });
        break;
    }
  };

  worker.onerror = (error) => {
    console.error('[Streaming] Worker error:', error);
  };
}

// ==========================================
// UPLOAD LOGIC
// ==========================================

sample({
  clock: compressionStarted,
  fn: ({ fileId, file }) => {
    console.log('[Streaming] compressionStarted:', {
      fileId,
      fileName: file.name,
      fileSize: file.size,
    });

    const message: any = {
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    };

    // Добавляем конфигурацию store если есть
    if (storeConfig) {
      message.store = storeConfig;
      console.log('[Streaming] Adding store config to message:', storeConfig);
    }

    console.log('[Streaming] Sending UploadStart to worker');
    const worker = getStoreWorker();
    worker.postMessage(message);
  },
});

// ==========================================
// CLEANUP
// ==========================================

export function terminateWorkers() {
  console.log('[Streaming] Terminating workers...');
  if (storeWorker) {
    storeWorker.terminate();
    storeWorker = null;
  }
  console.log('[Streaming] Workers terminated');
}
