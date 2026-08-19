

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
  mockFilesService.saveChunk = async (params: any) => {
    return { success: true };
  };
});

test('Worker mock → blockSaved → chunkMetadataSaved (без дубликатов)', async () => {
  const { services } = await import('./services');
  services.setFilesService(mockFilesService);

  await import('./integrations.test');

  const { blockSaved } = await import('./segments/store');
  const { chunkMetadataSaved } = await import('./segments/files');

  const scope = fork();

  const blockSavedEvents: any[] = [];
  const chunkMetadataSavedEvents: any[] = [];

  blockSaved.watch((event) => {
    blockSavedEvents.push(event);
  });

  chunkMetadataSaved.watch((event) => {
    chunkMetadataSavedEvents.push(event);
  });

  const workerMock = new WorkerMock();

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

  await workerMock.simulateUpload(fileId, file);

  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('blockSaved events:', blockSavedEvents.length);
  console.log('chunkMetadataSaved events:', chunkMetadataSavedEvents.length);

  expect(blockSavedEvents.length).toBe(2);
  expect(chunkMetadataSavedEvents.length).toBe(2);

  expect(blockSavedEvents[0].chunkNumber).toBe(0);
  expect(blockSavedEvents[1].chunkNumber).toBe(1);

  expect(blockSavedEvents[0].hash).toBe('hash_test-file-id_chunk_0');
  expect(blockSavedEvents[1].hash).toBe('hash_test-file-id_chunk_1');

  workerMock.clear();
});

test('Worker mock полный флоу с прогрессом', async () => {
  const { services } = await import('./services');
  services.setFilesService(mockFilesService);

  await import('./integrations.test');

  const { blockSaved } = await import('./segments/store');
  const { chunkMetadataSaved } = await import('./segments/files');
  const { chunkUploaded } = await import('./segments/browser');

  const scope = fork();

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

  console.log('Progress events:', progressEvents.length);
  console.log('ChunkReady events:', chunkReadyEvents.length);
  console.log('FileUploaded events:', fileUploadedEvents.length);
  console.log('blockSaved events:', blockSavedEvents.length);
  console.log('chunkMetadataSaved events:', chunkMetadataSavedEvents.length);
  console.log('chunkUploaded events:', chunkUploadedEvents.length);

  expect(progressEvents.length).toBe(3);

  expect(chunkReadyEvents.length).toBe(2);

  expect(fileUploadedEvents.length).toBe(1);

  expect(blockSavedEvents.length).toBe(2);

  expect(chunkMetadataSavedEvents.length).toBe(2);

  expect(chunkUploadedEvents.length).toBe(2);

  workerMock.clear();
});
