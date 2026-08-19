

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


const resolveBlockBytes = async (
  storeService: StoreService,
  hash: string,
): Promise<Uint8Array> => {
  const raw = await storeService.get(hash);
  if (
    raw &&
    typeof raw === "object" &&
    typeof (raw as { cacheKey?: unknown }).cacheKey === "string"
  ) {
    const cacheKey = (raw as { cacheKey: string }).cacheKey;
    const response = await fetch(`/cache/blob/${encodeURIComponent(cacheKey)}`);
    if (!response.ok) {
      throw new Error(`Cache blob download failed: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
  return normalizeBlockData(raw);
};

export async function downloadFile(
  fileId: string,
  filesService: FilesService,
  storeService: StoreService
): Promise<{ blob: Blob; fileName: string }> {
  const metadata = await filesService.get(fileId);
  const chunks = await filesService.getChunks(fileId);
  chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);

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

      for (const chunk of chunks) {
        const compressedData = await resolveBlockBytes(storeService, chunk.hash);
        const decompressedData = inflateSync(compressedData);

        await writable.write(decompressedData);
      }

      await writable.close();
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

  const decompressedChunks: Uint8Array[] = [];

  for (const chunk of chunks) {
    const compressedData = await resolveBlockBytes(storeService, chunk.hash);
    const decompressedData = inflateSync(compressedData);
    decompressedChunks.push(decompressedData);
  }

  const blob = new Blob(decompressedChunks as BlobPart[], { type: metadata.fileType });
  return {
    blob,
    fileName: metadata.name
  };
}
