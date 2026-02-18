import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { UploadWorkerIncomingMessage, UploadWorkerOutgoingMessage } from '../types';
import { UploadWorkerCommandType, UploadWorkerEventType } from '../types';

describe('Store Worker - Empty Chunk Prevention', () => {
  let worker: Worker;
  let messages: UploadWorkerOutgoingMessage[] = [];

  beforeEach(() => {
    messages = [];
    worker = new Worker(new URL('./store.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
      messages.push(event.data);
    };
  });

  afterEach(() => {
    worker.terminate();
  });

  test('should not emit ChunkReady events with chunkSize = 0', async () => {
    // Создаем тестовый файл
    const testData = new Uint8Array(1024 * 1024); // 1MB
    for (let i = 0; i < testData.length; i++) {
      testData[i] = i % 256;
    }

    const file = new File([testData], 'test.bin', { type: 'application/octet-stream' });

    const message: UploadWorkerIncomingMessage = {
      type: UploadWorkerCommandType.UploadStart,
      fileId: 'test-file-id' as any,
      file,
      store: {
        baseUrl: 'http://localhost:3001/services/store'
      }
    };

    worker.postMessage(message);

    // Ждем завершения загрузки
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const uploaded = messages.find(m => m.type === UploadWorkerEventType.FileUploaded);
        if (uploaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });

    // Проверяем что нет чанков с размером 0
    const chunkReadyMessages = messages.filter(m => m.type === UploadWorkerEventType.ChunkReady);

    for (const msg of chunkReadyMessages) {
      if (msg.type === UploadWorkerEventType.ChunkReady) {
        expect(msg.chunkSize).toBeGreaterThan(0);
        console.log(`Chunk ${msg.chunkNumber}: size=${msg.chunkSize}, hash=${msg.hash}`);
      }
    }

    expect(chunkReadyMessages.length).toBeGreaterThan(0);
  });

  test('should handle multiple files without empty chunks', async () => {
    const files = [
      new File([new Uint8Array(500 * 1024)], 'file1.bin'),
      new File([new Uint8Array(700 * 1024)], 'file2.bin'),
      new File([new Uint8Array(300 * 1024)], 'file3.bin'),
    ];

    for (const [index, file] of files.entries()) {
      const message: UploadWorkerIncomingMessage = {
        type: UploadWorkerCommandType.UploadStart,
        fileId: `file-${index}` as any,
        file,
        store: {
          baseUrl: 'http://localhost:3001/services/store'
        }
      };

      worker.postMessage(message);
    }

    // Ждем завершения всех загрузок
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const uploadedCount = messages.filter(m => m.type === UploadWorkerEventType.FileUploaded).length;
        if (uploadedCount === files.length) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });

    // Проверяем что нет чанков с размером 0
    const chunkReadyMessages = messages.filter(m => m.type === UploadWorkerEventType.ChunkReady);

    for (const msg of chunkReadyMessages) {
      if (msg.type === UploadWorkerEventType.ChunkReady) {
        expect(msg.chunkSize).toBeGreaterThan(0);
      }
    }

    console.log(`Total chunks emitted: ${chunkReadyMessages.length}`);
  });
});
