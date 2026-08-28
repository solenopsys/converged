

import { inflateSync } from 'fflate';
import type { FilesService, StoreService } from './services';


const resolveBlockBytes = async (
  storeService: StoreService,
  hash: string,
): Promise<Uint8Array> => {
  const ref = await storeService.get(hash);
  const response = await fetch(`/cache/blob/${encodeURIComponent(ref.cacheKey)}`);
  if (!response.ok) {
    throw new Error(`Cache blob download failed: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
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
