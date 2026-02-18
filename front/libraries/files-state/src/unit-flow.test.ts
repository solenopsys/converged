// unit-flow.test.ts - простой unit тест БЕЗ integrations
import { test, expect, mock } from 'bun:test';
import { fork, allSettled } from 'effector';
import type { HashString, UUID } from '../../../../types/files';

const mockFilesService: any = {
  save: mock(async (file: any) => file.id),
  saveChunk: mock(async (chunk: any) => {
    console.log('[MOCK] saveChunk:', chunk);
    return chunk.hash;
  }),
  get: mock(async (id: string) => ({ id })),
  update: mock(async () => {}),
  getChunks: mock(async () => []),
  delete: mock(async () => {})
};

test('chunkMetadataSaveRequested -> saveChunkMetadataFx -> chunkMetadataSaved', async () => {
  const { services } = await import('./services');
  services.setFilesService(mockFilesService);

  const { chunkMetadataSaveRequested, chunkMetadataSaved } = await import('./segments/files');

  mockFilesService.saveChunk.mockClear();

  const scope = fork();

  const fileId = 'test-file' as UUID;
  const hash = 'test-hash-abc123' as HashString;

  const savedEvents: any[] = [];
  chunkMetadataSaved.watch((event) => {
    console.log('[TEST] chunkMetadataSaved:', event);
    savedEvents.push(event);
  });

  // Триггерим chunkMetadataSaveRequested напрямую
  await allSettled(chunkMetadataSaveRequested, {
    scope,
    params: { fileId, chunkNumber: 0, hash, chunkSize: 1024 }
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  console.log('Saved events:', savedEvents.length);
  console.log('saveChunk calls:', mockFilesService.saveChunk.mock.calls.length);

  expect(savedEvents.length).toBe(1);
  expect(savedEvents[0].fileId).toBe(fileId);
  expect(savedEvents[0].chunkNumber).toBe(0);

  expect(mockFilesService.saveChunk.mock.calls.length).toBe(1);
  expect(mockFilesService.saveChunk.mock.calls[0][0].hash).toBe(hash);
});

test('3 чанка БЕЗ дублей', async () => {
  const { services } = await import('./services');
  services.setFilesService(mockFilesService);

  const { chunkMetadataSaveRequested, chunkMetadataSaved } = await import('./segments/files');

  mockFilesService.saveChunk.mockClear();

  const scope = fork();

  const fileId = 'multi-file' as UUID;

  const savedEvents: any[] = [];
  chunkMetadataSaved.watch((event) => {
    savedEvents.push(event);
  });

  // 3 чанка
  for (let i = 0; i < 3; i++) {
    await allSettled(chunkMetadataSaveRequested, {
      scope,
      params: {
        fileId,
        chunkNumber: i,
        hash: `hash-${i}` as HashString,
        chunkSize: 1024
      }
    });
  }

  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('\nSaved events:', savedEvents.length);
  console.log('saveChunk calls:', mockFilesService.saveChunk.mock.calls.length);

  // Ровно 3, БЕЗ дублей
  expect(savedEvents.length).toBe(3);
  expect(mockFilesService.saveChunk.mock.calls.length).toBe(3);

  for (let i = 0; i < 3; i++) {
    expect(savedEvents[i].chunkNumber).toBe(i);
  }
});
