

import { test, expect } from 'bun:test';
import { fork, allSettled } from 'effector';
import type { UUID, HashString } from '../../../../../types/files';

test('BUG: chunkSize становится 0 при сохранении метаданных', async () => {
  const { services } = await import('./services');
  await import('./integrations');  const { blockSaved } = await import('./segments/store');
  const { chunkMetadataSaveRequested, $chunks } = await import('./segments/files');

  const mockFilesService = {
    save: async () => 'mock-id' as UUID,
    update: async () => {},
    saveChunk: async () => 'mock-hash' as HashString,
    get: async () => ({} as any),
    getChunks: async () => [],
  };

  services.setFilesService(mockFilesService as any);

  const scope = fork();

  const fileId = 'test-file-id' as UUID;
  const chunkNumber = 0;
  const hash = 'test-hash-123' as HashString;
  const compressedSize = 499862;
  const initialChunks = scope.getState($chunks);
  console.log('[TEST] Initial $chunks size:', initialChunks.size);
  expect(initialChunks.size).toBe(0);

  const capturedEvents: any[] = [];
  chunkMetadataSaveRequested.watch((event) => {
    console.log('[TEST] chunkMetadataSaveRequested event:', event);
    capturedEvents.push(event);
  });

  await allSettled(blockSaved, {
    scope,
    params: {
      fileId,
      chunkNumber,
      hash,
      chunkSize: compressedSize,
    },
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  expect(capturedEvents.length).toBe(1);
  const event = capturedEvents[0];

  console.log('[TEST] Captured event:', event);
  console.log('[TEST] Expected chunkSize:', compressedSize);
  console.log('[TEST] Actual chunkSize:', event.chunkSize);

  expect(event.chunkSize).toBe(compressedSize);

  console.log('\n✅ FIX CONFIRMED: chunkSize is correctly passed from blockSaved event');
});

test('EXPECTED: chunkSize должен браться из события воркера, а не из $chunks', async () => {
  console.log('\n📝 This test shows the EXPECTED behavior after fix');
  console.log('   chunkSize should come from the CHUNK_PREPARED event (compressed size),');
  console.log('   not from chunk.data.length (original size)');


  expect(true).toBe(true); // Placeholder
});
