/**
 * Простая функция скачивания файла
 * Без всякого Effector говна
 */

import { inflateSync } from 'fflate';
import type { FilesService, StoreService } from './services';

const normalizeBlockData = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer);
  }

  if (typeof value === "string") {
    // Base64 строка - декодируем
    const binaryString = atob(value);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (record.__type === "Uint8Array" && "data" in record) {
      return normalizeBlockData(record.data);
    }
  }

  throw new Error("StoreService.get returned invalid data");
};

export async function downloadFile(
  fileId: string,
  filesService: FilesService,
  storeService: StoreService
): Promise<{ blob: Blob; fileName: string }> {
  console.log('[downloadFile] Starting download for:', fileId);

  // 1. Загружаем метаданные файла
  const metadata = await filesService.get(fileId);
  console.log('[downloadFile] Metadata loaded:', metadata);

  // 2. Загружаем список чанков
  const chunks = await filesService.getChunks(fileId);
  console.log('[downloadFile] Chunks loaded:', chunks.length);

  // Сортируем чанки по номеру
  chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);

  // 3. Пробуем использовать File System Access API
  const hasFileSystemAPI = 'showSaveFilePicker' in window;

  if (hasFileSystemAPI) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: metadata.name,
        types: metadata.fileType ? [{
          description: 'File',
          accept: { [metadata.fileType]: [] }
        }] : undefined
      });

      const writable = await handle.createWritable();

      // Загружаем и записываем чанки по одному
      for (const chunk of chunks) {
        console.log('[downloadFile] Processing chunk:', chunk.chunkNumber);

        const rawData = await storeService.get(chunk.hash);
        const compressedData = normalizeBlockData(rawData);
        const decompressedData = inflateSync(compressedData);

        await writable.write(decompressedData);
      }

      await writable.close();
      console.log('[downloadFile] File written successfully via File System Access API');

      // Возвращаем пустой blob, т.к. файл уже записан
      return {
        blob: new Blob([]),
        fileName: metadata.name
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('User cancelled download');
      }
      console.warn('[downloadFile] File System Access API failed, falling back to blob:', error);
    }
  }

  // 4. Fallback: собираем в память и создаем blob
  console.log('[downloadFile] Using blob fallback');
  const decompressedChunks: Uint8Array[] = [];

  for (const chunk of chunks) {
    const rawData = await storeService.get(chunk.hash);
    const compressedData = normalizeBlockData(rawData);
    const decompressedData = inflateSync(compressedData);
    decompressedChunks.push(decompressedData);
  }

  const blob = new Blob(decompressedChunks as BlobPart[], { type: metadata.fileType });
  console.log('[downloadFile] Blob created:', blob.size, 'bytes');

  return {
    blob,
    fileName: metadata.name
  };
}
