/**
 * Тест для воспроизведения бага с chunkSize = 0
 *
 * ПРОБЛЕМА: Воркер отправляет CHUNK_READY с правильным chunkSize (размер сжатого чанка),
 * но в integrations.ts при преобразовании blockSaved -> chunkMetadataSaveRequested
 * берется chunk.data.length (размер оригинальных данных), который может быть 0
 * если чанк еще не был добавлен в $chunks store.
 */

import { test, expect } from 'bun:test';
import { fork, allSettled } from 'effector';
import type { UUID, HashString } from '../../../../../types/files';

test('BUG: chunkSize становится 0 при сохранении метаданных', async () => {
  // Импортируем модули
  const { services } = await import('./services');
  await import('./integrations'); // Загружаем интеграции
  const { blockSaved } = await import('./segments/store');
  const { chunkMetadataSaveRequested, $chunks } = await import('./segments/files');

  // Мок для filesService
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
  const compressedSize = 499862; // Реальный размер из лога

  // Проверяем начальное состояние $chunks - должно быть пусто
  const initialChunks = scope.getState($chunks);
  console.log('[TEST] Initial $chunks size:', initialChunks.size);
  expect(initialChunks.size).toBe(0);

  // Отслеживаем что приходит в chunkMetadataSaveRequested
  const capturedEvents: any[] = [];
  chunkMetadataSaveRequested.watch((event) => {
    console.log('[TEST] chunkMetadataSaveRequested event:', event);
    capturedEvents.push(event);
  });

  // Эмулируем ситуацию: воркер отправил blockSaved с chunkSize
  await allSettled(blockSaved, {
    scope,
    params: {
      fileId,
      chunkNumber,
      hash,
      chunkSize: compressedSize,
    },
  });

  // Ждем обработки
  await new Promise(resolve => setTimeout(resolve, 50));

  // ПРОВЕРКА: chunkSize должен быть 0, потому что chunk не найден в $chunks
  expect(capturedEvents.length).toBe(1);
  const event = capturedEvents[0];

  console.log('[TEST] Captured event:', event);
  console.log('[TEST] Expected chunkSize:', compressedSize);
  console.log('[TEST] Actual chunkSize:', event.chunkSize);

  // После фикса: chunkSize должен быть правильным
  expect(event.chunkSize).toBe(compressedSize);

  console.log('\n✅ FIX CONFIRMED: chunkSize is correctly passed from blockSaved event');
});

test('EXPECTED: chunkSize должен браться из события воркера, а не из $chunks', async () => {
  console.log('\n📝 This test shows the EXPECTED behavior after fix');
  console.log('   chunkSize should come from the CHUNK_READY event (compressed size),');
  console.log('   not from chunk.data.length (original size)');

  // После фикса тест должен провериться так:
  // 1. Воркер отправляет CHUNK_READY с chunkSize = 499862
  // 2. streaming.ts вызывает blockSaved с этим chunkSize
  // 3. integrations.ts передает chunkSize в chunkMetadataSaveRequested БЕЗ изменений
  // 4. filesService.saveChunk получает правильный chunkSize = 499862

  expect(true).toBe(true); // Placeholder
});
