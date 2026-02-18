import { test, expect, describe, beforeEach, mock } from 'bun:test';
import { allSettled, fork } from 'effector';

// Создаем mock сервисы
const mockFilesService: any = {
  save: mock(async (file: any) => file.id),
  saveChunk: mock(async (chunk: any) => {
    console.log('[MOCK] saveChunk called with:', chunk);
    return chunk.hash;
  }),
  update: mock(async () => {}),
  delete: mock(async () => {}),
  get: mock(async (id: string) => ({ id })),
  getChunks: mock(async () => []),
  list: mock(async () => ({ items: [], totalCount: 0 })),
  statistic: mock(async () => ({})),
};

const mockStoreService: any = {
  save: mock(async (data: Uint8Array) => 'mock-hash-' + data.length),
  get: mock(async () => new Uint8Array(0)),
  delete: mock(async () => {}),
  exists: mock(async () => true),
  list: mock(async () => ({ items: [], totalCount: 0 })),
  storeStatistic: mock(async () => ({})),
};

describe('Integration: chunkMetadataSaveRequested -> chunkMetadataSaved', () => {
  beforeEach(() => {
    // Очищаем моки перед каждым тестом
    mockFilesService.saveChunk.mockClear();
  });

  test('should call filesService.saveChunk and trigger chunkMetadataSaved', async () => {
    // Инициализируем сервисы
    const { services } = await import('../services');
    services.setFilesService(mockFilesService);
    services.setStoreService(mockStoreService);

    // Импортируем модули после инициализации сервисов
    const filesModule = await import('./files');

    const scope = fork();

    const fileId = 'test-file-id';
    const hash = 'test-hash-123abc';
    const chunkNumber = 0;

    // Отслеживаем события chunkMetadataSaved
    const savedEvents: any[] = [];
    filesModule.chunkMetadataSaved.watch((event) => {
      console.log('[TEST] chunkMetadataSaved event:', event);
      savedEvents.push(event);
    });

    // Запускаем сохранение метаданных чанка
    await allSettled(filesModule.chunkMetadataSaveRequested, {
      scope,
      params: {
        fileId,
        chunkNumber,
        hash,
        chunkSize: 1024
      }
    });

    // Даем время на обработку асинхронных операций
    await new Promise(resolve => setTimeout(resolve, 100));

    // Проверяем что saveChunk был вызван
    console.log('[TEST] saveChunk mock calls:', mockFilesService.saveChunk.mock.calls.length);
    expect(mockFilesService.saveChunk).toHaveBeenCalled();

    const call = mockFilesService.saveChunk.mock.calls[0];
    expect(call[0].fileId).toBe(fileId);
    expect(call[0].hash).toBe(hash);
    expect(call[0].chunkNumber).toBe(chunkNumber);

    // Проверяем что событие chunkMetadataSaved было вызвано
    console.log('[TEST] savedEvents:', savedEvents);
    expect(savedEvents.length).toBeGreaterThan(0);
    expect(savedEvents[0].fileId).toBe(fileId);
    expect(savedEvents[0].chunkNumber).toBe(chunkNumber);
  });

  test('multiple chunks should be saved sequentially', async () => {
    const { services } = await import('../services');
    services.setFilesService(mockFilesService);
    services.setStoreService(mockStoreService);

    const filesModule = await import('./files');
    const scope = fork();

    const fileId = 'multi-chunk-file';
    const chunks = [
      { chunkNumber: 0, hash: 'hash-0', chunkSize: 512 },
      { chunkNumber: 1, hash: 'hash-1', chunkSize: 512 },
      { chunkNumber: 2, hash: 'hash-2', chunkSize: 512 },
    ];

    // Сохраняем все чанки
    for (const chunk of chunks) {
      await allSettled(filesModule.chunkMetadataSaveRequested, {
        scope,
        params: {
          fileId,
          ...chunk
        }
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Проверяем что saveChunk был вызван для каждого чанка
    expect(mockFilesService.saveChunk.mock.calls.length).toBe(3);

    // Проверяем что все чанки сохранены с правильными хешами
    const calls = mockFilesService.saveChunk.mock.calls;
    expect(calls[0][0].hash).toBe('hash-0');
    expect(calls[1][0].hash).toBe('hash-1');
    expect(calls[2][0].hash).toBe('hash-2');
  });
});
