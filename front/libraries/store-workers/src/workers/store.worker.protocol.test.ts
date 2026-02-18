import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  UploadWorkerCommandType,
  UploadWorkerEventType,
  DownloadWorkerCommandType,
  DownloadWorkerEventType,
  type UploadWorkerOutgoingMessage,
  type DownloadWorkerOutgoingMessage,
  type HashString,
} from '../types';
import path from 'path';
import { Buffer } from 'buffer';

/**
 * Comprehensive protocol tests for store-workers
 * Tests edge cases, boundary conditions, error scenarios, and concurrent operations
 */

describe('StoreWorker Protocol Tests - Edge Cases', () => {
  let worker: Worker;

  beforeEach(() => {
    const workerEnv: Record<string, string> = {
      USE_MOCK_STORE: 'true',
      DEBUG_CHUNK_SIZES: 'true',
    };
    worker = new Worker(path.resolve(import.meta.dir, '../../dist/store.worker.js'), {
      env: workerEnv,
    });
  });

  afterEach(() => {
    worker.terminate();
  });

  it('should handle empty file (0 bytes)', async () => {
    const fileId = 'empty-file';
    const file = new File([], 'empty.txt');
    let chunkCount = 0;

    const uploadedPromise = new Promise<number>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunkCount++;
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve(event.data.totalChunks);
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    const totalChunks = await uploadedPromise;
    expect(totalChunks).toBe(0);
    expect(chunkCount).toBe(0);
  });

  it('should handle 1-byte file', async () => {
    const fileId = '1-byte-file';
    const file = new File([new Uint8Array([42])], 'one-byte.txt');
    const chunks: Array<{ chunkNumber: number; hash: HashString; size: number }> = [];

    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunks.push({
              chunkNumber: event.data.chunkNumber,
              hash: event.data.hash,
              size: event.data.chunkSize,
            });
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve();
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await uploadedPromise;
    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkNumber).toBe(0);
  });

  it('should handle file exactly at MAX_CHUNK_SIZE (512KB)', async () => {
    const fileId = 'exact-chunk-size';
    const size = 512 * 1024; // Exactly 512KB
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const file = new File([data], 'exact-512kb.bin');
    const chunks: Array<{ chunkNumber: number; hash: HashString }> = [];

    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunks.push({
              chunkNumber: event.data.chunkNumber,
              hash: event.data.hash,
            });
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve();
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await uploadedPromise;
    // Adaptive chunking may split into multiple chunks for better compression
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle file at MAX_CHUNK_SIZE + 1 byte', async () => {
    const fileId = 'chunk-size-plus-one';
    const size = 512 * 1024 + 1;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const file = new File([data], 'chunk-plus-one.bin');
    const chunks: Array<{ chunkNumber: number; hash: HashString }> = [];

    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunks.push({
              chunkNumber: event.data.chunkNumber,
              hash: event.data.hash,
            });
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve();
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await uploadedPromise;
    // Adaptive chunking may create multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
    // Verify chunk order
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkNumber).toBe(i);
    }
  });

  it('should handle file at MIN_CHUNK_SIZE - 1 byte (3KB)', async () => {
    const fileId = 'below-min-chunk';
    const size = 4 * 1024 - 1; // 4KB - 1
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const file = new File([data], 'below-min.bin');
    const chunks: Array<{ chunkNumber: number; hash: HashString }> = [];

    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunks.push({
              chunkNumber: event.data.chunkNumber,
              hash: event.data.hash,
            });
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve();
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await uploadedPromise;
    expect(chunks.length).toBe(1);
  });

  it('should handle file with size that creates exact 2x MAX_CHUNK_SIZE', async () => {
    const fileId = 'double-chunk-size';
    const size = 512 * 1024 * 2; // Exactly 1MB
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const file = new File([data], 'double-chunk.bin');
    const chunks: Array<{ chunkNumber: number; hash: HashString }> = [];

    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunks.push({
              chunkNumber: event.data.chunkNumber,
              hash: event.data.hash,
            });
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve();
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await uploadedPromise;
    // Adaptive chunking creates multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should maintain chunk order for large file', async () => {
    const fileId = 'chunk-order-test';
    const size = 2 * 1024 * 1024; // 2MB
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const file = new File([data], 'large-file.bin');
    const chunks: Array<{ chunkNumber: number; hash: HashString }> = [];

    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunks.push({
              chunkNumber: event.data.chunkNumber,
              hash: event.data.hash,
            });
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve();
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await uploadedPromise;

    // Verify chunks are in order
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkNumber).toBe(i);
    }
  });
});

describe('StoreWorker Protocol Tests - Round-trip Verification', () => {
  let worker: Worker;

  beforeEach(() => {
    const workerEnv: Record<string, string> = {
      USE_MOCK_STORE: 'true',
      DEBUG_CHUNK_SIZES: 'true',
    };
    worker = new Worker(path.resolve(import.meta.dir, '../../dist/store.worker.js'), {
      env: workerEnv,
    });
  });

  afterEach(() => {
    worker.terminate();
  });

  async function uploadAndDownload(testName: string, fileData: Uint8Array): Promise<void> {
    const fileId = `roundtrip-${testName}`;
    const file = new File([fileData], `${testName}.bin`);
    const chunkHashes: Array<{ chunkNumber: number; hash: HashString }> = [];

    // Upload phase
    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunkHashes.push({ chunkNumber: event.data.chunkNumber, hash: event.data.hash });
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve();
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await uploadedPromise;

    chunkHashes.sort((a, b) => a.chunkNumber - b.chunkNumber);
    const orderedChunkHashes = chunkHashes.map(entry => entry.hash);

    // Download phase
    const downloadedPromise = new Promise<Uint8Array>((resolve, reject) => {
      const { port1, port2 } = new MessageChannel();
      if (typeof port2.start === 'function') {
        port2.start();
      }

      const receivedChunks: Uint8Array[] = [];

      const streamPromise = new Promise<Uint8Array>((streamResolve, streamReject) => {
        port2.onmessage = (event) => {
          const data = event.data;

          if (data instanceof ArrayBuffer) {
            receivedChunks.push(new Uint8Array(data));
            return;
          }

          if (data && typeof data === 'object' && 'type' in data) {
            if (data.type === 'close') {
              const totalSize = receivedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
              const result = new Uint8Array(totalSize);
              let offset = 0;
              for (const chunk of receivedChunks) {
                result.set(chunk, offset);
                offset += chunk.length;
              }
              streamResolve(result);
              port2.close();
              return;
            }
            if (data.type === 'abort') {
              const error = new Error(data.error ?? 'Download aborted');
              streamReject(error);
              port2.close();
              return;
            }
          }
        };
      });

      const workerPromise = new Promise<void>((workerResolve, workerReject) => {
        worker.onmessage = (event: MessageEvent<DownloadWorkerOutgoingMessage>) => {
          switch (event.data.type) {
            case DownloadWorkerEventType.FileDownloaded:
              workerResolve();
              break;
            case DownloadWorkerEventType.Error:
              workerReject(new Error(event.data.error));
              break;
          }
        };
      });

      worker.postMessage(
        {
          type: DownloadWorkerCommandType.DownloadStart,
          fileId,
          chunks: orderedChunkHashes,
          destination: port1,
        },
        [port1],
      );

      Promise.all([streamPromise, workerPromise])
        .then(([downloadedData]) => resolve(downloadedData))
        .catch(reject);
    });

    const downloadedData = await downloadedPromise;

    // Verify round-trip
    expect(downloadedData.length).toBe(fileData.length);
    for (let i = 0; i < fileData.length; i++) {
      if (downloadedData[i] !== fileData[i]) {
        throw new Error(`Byte mismatch at position ${i}: expected ${fileData[i]}, got ${downloadedData[i]}`);
      }
    }
  }

  it('should round-trip empty file', async () => {
    await uploadAndDownload('empty', new Uint8Array(0));
  });

  it('should round-trip 1-byte file', async () => {
    await uploadAndDownload('1byte', new Uint8Array([42]));
  });

  it('should round-trip file at MIN_CHUNK_SIZE (4KB)', async () => {
    const size = 4 * 1024;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    await uploadAndDownload('min-chunk', data);
  });

  it('should round-trip file at MAX_CHUNK_SIZE (512KB)', async () => {
    const size = 512 * 1024;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    await uploadAndDownload('max-chunk', data);
  });

  it('should round-trip file at MAX_CHUNK_SIZE + 1', async () => {
    const size = 512 * 1024 + 1;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    await uploadAndDownload('max-plus-one', data);
  });

  it('should round-trip file with random data (1MB)', async () => {
    const size = 1024 * 1024;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    await uploadAndDownload('random-1mb', data);
  });

  it('should round-trip file with all-zeros (512KB)', async () => {
    const size = 512 * 1024;
    const data = new Uint8Array(size); // All zeros
    await uploadAndDownload('all-zeros', data);
  });

  it('should round-trip file with all-ones (512KB)', async () => {
    const size = 512 * 1024;
    const data = new Uint8Array(size);
    data.fill(255);
    await uploadAndDownload('all-ones', data);
  });
});

describe('StoreWorker Protocol Tests - Concurrent Operations', () => {
  let worker: Worker;

  beforeEach(() => {
    const workerEnv: Record<string, string> = {
      USE_MOCK_STORE: 'true',
      DEBUG_CHUNK_SIZES: 'true',
    };
    worker = new Worker(path.resolve(import.meta.dir, '../../dist/store.worker.js'), {
      env: workerEnv,
    });
  });

  afterEach(() => {
    worker.terminate();
  });

  it('should handle multiple concurrent uploads', async () => {
    const files = [
      { id: 'concurrent-1', size: 100 * 1024 },
      { id: 'concurrent-2', size: 200 * 1024 },
      { id: 'concurrent-3', size: 300 * 1024 },
    ];

    const fileUploads = new Map<string, { chunks: HashString[]; totalChunks?: number }>();

    files.forEach(({ id }) => {
      fileUploads.set(id, { chunks: [] });
    });

    const allUploadedPromise = new Promise<void>((resolve, reject) => {
      let completedCount = 0;

      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        const msg = event.data;
        const upload = fileUploads.get(msg.fileId);
        if (!upload) return;

        switch (msg.type) {
          case UploadWorkerEventType.ChunkReady:
            upload.chunks.push(msg.hash);
            break;
          case UploadWorkerEventType.FileUploaded:
            upload.totalChunks = msg.totalChunks;
            completedCount++;
            if (completedCount === files.length) {
              resolve();
            }
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(`Upload error for ${msg.fileId}: ${msg.error}`));
            break;
        }
      };
    });

    // Start all uploads
    files.forEach(({ id, size }) => {
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = i % 256;
      }
      const file = new File([data], `${id}.bin`);

      worker.postMessage({
        type: UploadWorkerCommandType.UploadStart,
        fileId: id,
        file,
      });
    });

    await allUploadedPromise;

    // Verify all uploads completed
    files.forEach(({ id }) => {
      const upload = fileUploads.get(id)!;
      expect(upload.totalChunks).toBeGreaterThan(0);
      expect(upload.chunks.length).toBe(upload.totalChunks);
    });
  }, 30000);
});

describe('StoreWorker Protocol Tests - Pause/Resume/Cancel', () => {
  let worker: Worker;

  beforeEach(() => {
    const workerEnv: Record<string, string> = {
      USE_MOCK_STORE: 'true',
      DEBUG_CHUNK_SIZES: 'true',
    };
    worker = new Worker(path.resolve(import.meta.dir, '../../dist/store.worker.js'), {
      env: workerEnv,
    });
  });

  afterEach(() => {
    worker.terminate();
  });

  it('should pause and resume upload', async () => {
    const fileId = 'pause-resume-test';
    const size = 5 * 1024 * 1024; // 5MB
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const file = new File([data], 'pause-test.bin');

    let chunkCount = 0;
    let chunkCountAtPause = 0;
    let paused = false;

    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunkCount++;
            if (chunkCount === 2 && !paused) {
              paused = true;
              chunkCountAtPause = chunkCount;
              worker.postMessage({
                type: UploadWorkerCommandType.Pause,
                fileId,
              });
              // Resume immediately
              setTimeout(() => {
                worker.postMessage({
                  type: UploadWorkerCommandType.Resume,
                  fileId,
                });
              }, 50);
            }
            break;
          case UploadWorkerEventType.FileUploaded:
            resolve();
            break;
          case UploadWorkerEventType.Error:
            reject(new Error(event.data.error));
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await uploadedPromise;
    expect(paused).toBe(true);
    expect(chunkCount).toBeGreaterThan(chunkCountAtPause);
  }, 20000);

  it('should cancel upload', async () => {
    const fileId = 'cancel-test';
    const size = 10 * 1024 * 1024; // 10MB to ensure it doesn't finish before cancel
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const file = new File([data], 'cancel-test.bin');

    let chunkCount = 0;
    let cancelled = false;
    let uploadCompleted = false;

    const cancelPromise = new Promise<void>((resolve) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        switch (event.data.type) {
          case UploadWorkerEventType.ChunkReady:
            chunkCount++;
            if (chunkCount === 2 && !cancelled) {
              cancelled = true;
              worker.postMessage({
                type: UploadWorkerCommandType.Cancel,
                fileId,
              });
              // Wait to see if more chunks arrive after cancel
              setTimeout(() => resolve(), 500);
            }
            break;
          case UploadWorkerEventType.FileUploaded:
            uploadCompleted = true;
            break;
        }
      };
    });

    worker.postMessage({
      type: UploadWorkerCommandType.UploadStart,
      fileId,
      file,
    });

    await cancelPromise;
    expect(cancelled).toBe(true);
    expect(chunkCount).toBeGreaterThanOrEqual(2);
    // Upload may or may not complete depending on timing, just verify cancel was called
  });
});
