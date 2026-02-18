/**
 * Тест флоу скачивания файла
 *
 * Что должно происходить:
 * 1. downloadRequested(fileId, fileName)
 * 2. Загрузить метаданные файла из БД
 * 3. Загрузить список чанков из БД (hash, chunkNumber)
 * 4. Для каждого чанка:
 *    - Загрузить данные из store по hash
 *    - Декомпрессировать (inflate)
 *    - Добавить в буфер
 * 5. Когда все чанки загружены - скачать файл на диск
 */

import { test, expect, beforeEach } from 'bun:test';
import { fork, allSettled } from 'effector';
import { deflateSync } from 'fflate';

const fileId = 'test-file-download';
const fileName = 'test.png';

// Создаем валидные сжатые данные
const originalChunk0 = new Uint8Array([1, 2, 3, 4, 5]);
const originalChunk1 = new Uint8Array([6, 7, 8, 9, 10]);
const chunk0Data = deflateSync(originalChunk0); // валидные deflate данные
const chunk1Data = deflateSync(originalChunk1); // валидные deflate данные

// Mock данные
const mockFileMetadata = {
  id: fileId,
  name: fileName,
  fileSize: originalChunk0.length + originalChunk1.length,
  fileType: 'image/png',
  compression: 'deflate' as const,
  owner: 'test',
  createdAt: new Date(),
  status: 'uploaded' as const,
  hash: '',
  chunksCount: 2
};

const mockChunks = [
  { fileId, chunkNumber: 0, hash: 'hash0', chunkSize: chunk0Data.length, createdAt: new Date() },
  { fileId, chunkNumber: 1, hash: 'hash1', chunkSize: chunk1Data.length, createdAt: new Date() },
];

const mockFilesService = {
  get: async (id: string) => mockFileMetadata,
  getChunks: async (id: string) => mockChunks,
  save: async (file: any) => file,
  update: async (id: string, file: any) => {},
  saveChunk: async (chunk: any) => chunk.hash,
};

const mockStoreService = {
  save: async (data: Uint8Array) => 'fake-hash',
  get: async (hash: string) => {
    if (hash === 'hash0') return chunk0Data;
    if (hash === 'hash1') return chunk1Data;
    throw new Error('Unknown hash');
  },
};

beforeEach(() => {
  // Reset mocks
});

test('Скачивание файла: downloadRequested -> данные загружены -> файл сохранен', async () => {
  const { services } = await import('./services');
  services.setFilesService(mockFilesService);
  services.setStoreService(mockStoreService);

  // Импортируем события
  const { downloadRequested } = await import('./segments/browser');

  // TODO: Нужно событие которое сигнализирует что файл скачан
  // const { fileDownloaded } = await import('./segments/browser');

  const scope = fork();

  // Запускаем скачивание
  await allSettled(downloadRequested, {
    scope,
    params: { fileId, fileName }
  });

  // Даем время на обработку
  await new Promise(resolve => setTimeout(resolve, 500));

  // Проверяем что все чанки были запрошены из store
  // Проверяем что файл был сохранен

  console.log('Test completed - check that file was downloaded');
});

test('downloadFile: загружает чанки, декомпрессирует, возвращает blob', async () => {
  const { downloadFile } = await import('./download');

  const result = await downloadFile(fileId, mockFilesService as any, mockStoreService as any);

  // Проверяем что blob создан
  expect(result.blob).toBeDefined();
  expect(result.blob.size).toBe(originalChunk0.length + originalChunk1.length);
  expect(result.fileName).toBe(fileName);

  // Проверяем содержимое blob
  const arrayBuffer = await result.blob.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Должно быть объединение двух чанков
  const expected = new Uint8Array(originalChunk0.length + originalChunk1.length);
  expected.set(originalChunk0, 0);
  expected.set(originalChunk1, originalChunk0.length);

  expect(data).toEqual(expected);

  console.log('✓ Download completed:', {
    fileName: result.fileName,
    size: result.blob.size,
    contentCorrect: true
  });
});
