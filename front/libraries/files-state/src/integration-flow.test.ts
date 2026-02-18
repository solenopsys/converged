/**
 * Интеграционный тест с mock воркера
 * Проверяет полный флоу: Worker → files-state → DB
 */

import { test, expect, beforeEach } from 'bun:test';
import { fork, allSettled } from 'effector';
import { WorkerMock, UploadWorkerEventType } from './__mocks__/worker.mock';

const fileId = 'test-file-id';
const file = new File(['test content with enough data for two chunks'], 'test.txt');

const mockFilesService = {
  saveChunk: async (params: any) => {
    return { success: true };
  },
};

beforeEach(() => {
  // Очищаем mock перед каждым тестом
  mockFilesService.saveChunk = async (params: any) => {
    return { success: true };
  };
});

test('Worker mock → blockSaved → chunkMetadataSaved (без дубликатов)', async () => {
  // Импорт модулей
  const { services } = await import('./services');
  services.setFilesService(mockFilesService);

  // Импортируем integrations.test.ts для активации связей (без воркера)
  await import('./integrations.test');

  const { blockSaved } = await import('./segments/store');
  const { chunkMetadataSaved } = await import('./segments/files');

  // Создаем scope для изоляции
  const scope = fork();

  // Счетчики событий
  const blockSavedEvents: any[] = [];
  const chunkMetadataSavedEvents: any[] = [];

  // Подписываемся на события
  blockSaved.watch((event) => {
    blockSavedEvents.push(event);
  });

  chunkMetadataSaved.watch((event) => {
    chunkMetadataSavedEvents.push(event);
  });

  // Создаем worker mock
  const workerMock = new WorkerMock();

  // Подключаем mock к blockSaved
  workerMock.onMessage((message) => {
    if (message.type === UploadWorkerEventType.ChunkReady) {
      blockSaved({
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        hash: message.hash,
        chunkSize: message.chunkSize,
      });
    }
  });

  // Запускаем симуляцию загрузки
  await workerMock.simulateUpload(fileId, file);

  // Даем время на обработку всех событий
  await new Promise(resolve => setTimeout(resolve, 100));

  // Проверяем результаты
  console.log('blockSaved events:', blockSavedEvents.length);
  console.log('chunkMetadataSaved events:', chunkMetadataSavedEvents.length);

  // Должно быть 2 чанка (как задано в WorkerMock)
  expect(blockSavedEvents.length).toBe(2);
  expect(chunkMetadataSavedEvents.length).toBe(2);

  // Проверяем что это разные чанки
  expect(blockSavedEvents[0].chunkNumber).toBe(0);
  expect(blockSavedEvents[1].chunkNumber).toBe(1);

  // Проверяем хеши
  expect(blockSavedEvents[0].hash).toBe('hash_test-file-id_chunk_0');
  expect(blockSavedEvents[1].hash).toBe('hash_test-file-id_chunk_1');

  workerMock.clear();
});

test('Worker mock полный флоу с прогрессом', async () => {
  const { services } = await import('./services');
  services.setFilesService(mockFilesService);

  // Импортируем integrations.test.ts для активации связей (без воркера)
  await import('./integrations.test');

  const { blockSaved } = await import('./segments/store');
  const { chunkMetadataSaved } = await import('./segments/files');
  const { chunkUploaded } = await import('./segments/browser');

  const scope = fork();

  // Счетчики всех типов событий
  const progressEvents: any[] = [];
  const chunkReadyEvents: any[] = [];
  const fileUploadedEvents: any[] = [];
  const blockSavedEvents: any[] = [];
  const chunkMetadataSavedEvents: any[] = [];
  const chunkUploadedEvents: any[] = [];

  blockSaved.watch((event) => {
    blockSavedEvents.push(event);
  });

  chunkMetadataSaved.watch((event) => {
    chunkMetadataSavedEvents.push(event);
  });

  chunkUploaded.watch((event) => {
    chunkUploadedEvents.push(event);
  });

  const workerMock = new WorkerMock();

  workerMock.onMessage((message) => {
    switch (message.type) {
      case UploadWorkerEventType.UploadProgress:
        progressEvents.push(message);
        break;
      case UploadWorkerEventType.ChunkReady:
        chunkReadyEvents.push(message);
        blockSaved({
          fileId: message.fileId,
          chunkNumber: message.chunkNumber,
          hash: message.hash,
          chunkSize: message.chunkSize,
        });
        break;
      case UploadWorkerEventType.FileUploaded:
        fileUploadedEvents.push(message);
        break;
    }
  });

  await workerMock.simulateUpload(fileId, file);
  await new Promise(resolve => setTimeout(resolve, 100));

  // Проверяем полный флоу
  console.log('Progress events:', progressEvents.length);
  console.log('ChunkReady events:', chunkReadyEvents.length);
  console.log('FileUploaded events:', fileUploadedEvents.length);
  console.log('blockSaved events:', blockSavedEvents.length);
  console.log('chunkMetadataSaved events:', chunkMetadataSavedEvents.length);
  console.log('chunkUploaded events:', chunkUploadedEvents.length);

  // Worker должен отправить 3 UPLOAD_PROGRESS (0%, 50%, 100%)
  expect(progressEvents.length).toBe(3);

  // Worker должен отправить 2 CHUNK_READY
  expect(chunkReadyEvents.length).toBe(2);

  // Worker должен отправить 1 FILE_UPLOADED
  expect(fileUploadedEvents.length).toBe(1);

  // files-state должен обработать 2 blockSaved
  expect(blockSavedEvents.length).toBe(2);

  // files-state должен сохранить 2 chunkMetadataSaved (БЕЗ ДУБЛИКАТОВ!)
  expect(chunkMetadataSavedEvents.length).toBe(2);

  // files-state должен отправить 2 chunkUploaded для UI
  expect(chunkUploadedEvents.length).toBe(2);

  workerMock.clear();
});
