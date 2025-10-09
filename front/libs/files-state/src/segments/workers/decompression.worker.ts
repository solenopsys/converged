// segments/workers/decompression.worker.ts
import { Inflate } from 'fflate';
import type {
  DecompressionWorkerIncomingMessage,
  DecompressionWorkerOutgoingMessage,
} from './types';

// ==========================================
// MESSAGE HANDLER
// ==========================================

self.onmessage = async (event: MessageEvent<DecompressionWorkerIncomingMessage>) => {
  const message = event.data;

  console.log('[DecompressionWorker] Received message:', message.type, {
    fileId: message.fileId,
    chunkNumber: message.chunkNumber,
    dataSize: message.data.length,
    isLastChunk: message.isLastChunk
  });

  if (message.type === 'DECOMPRESS_CHUNK') {
    try {
      console.log('[DecompressionWorker] Starting decompression...');
      const decompressed = await decompressChunk(message.data, message.isLastChunk);

      console.log('[DecompressionWorker] Decompression complete:', {
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        originalSize: message.data.length,
        decompressedSize: decompressed.length
      });

      const response: DecompressionWorkerOutgoingMessage = {
        type: 'CHUNK_DECOMPRESSED',
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        data: decompressed,
      };

      // Transfer ownership
      self.postMessage(response, [decompressed.buffer]);
      console.log('[DecompressionWorker] CHUNK_DECOMPRESSED message sent');
    } catch (error) {
      console.error('[DecompressionWorker] Decompression error:', {
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        error
      });

      const response: DecompressionWorkerOutgoingMessage = {
        type: 'ERROR',
        fileId: message.fileId,
        chunkNumber: message.chunkNumber,
        error: error instanceof Error ? error.message : String(error),
      };

      self.postMessage(response);
    }
  }
};

// ==========================================
// DECOMPRESSION LOGIC
// ==========================================

async function decompressChunk(
  data: Uint8Array,
  final: boolean
): Promise<Uint8Array> {
  console.log('[DecompressionWorker] decompressChunk called:', {
    dataSize: data.length,
    final
  });

  return new Promise((resolve, reject) => {
    const inflate = new Inflate();

    inflate.ondata = (decompressed) => {
      console.log('[DecompressionWorker] Inflate ondata:', {
        decompressedSize: decompressed.length
      });
      resolve(decompressed);
    };

    inflate.onerror = (error) => {
      console.error('[DecompressionWorker] Inflate error:', error);
      reject(error);
    };

    try {
      console.log('[DecompressionWorker] Pushing data to inflate...');
      inflate.push(data, final);
    } catch (error) {
      console.error('[DecompressionWorker] Push error:', error);
      reject(error);
    }
  });
}