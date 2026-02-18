import { describe, it, expect } from 'bun:test';
import { UploadWorkerCommandType, UploadWorkerEventType, DownloadWorkerCommandType, DownloadWorkerEventType, type UploadWorkerOutgoingMessage, type DownloadWorkerOutgoingMessage, type HashString } from '../types';
import path from 'path';
import fs from 'fs';
import { Buffer } from 'buffer';

describe('StoreWorker integration test', () => {

  it('should upload a file, then download it and verify the content', async () => {
    const workerEnv: Record<string, string> = {
      USE_MOCK_STORE: 'true',
      DEBUG_CHUNK_SIZES: 'true',
    };

    const worker = new Worker(path.resolve(import.meta.dir, '../../dist/store.worker.js'), {
      env: workerEnv,
    });

    const inputFile = path.resolve(import.meta.dir, '../../test_file.png');
    const outputFile = path.resolve(import.meta.dir, '../../test_file_out.png');
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }
    const fileId = 'test-file-id';

    const file = new File([fs.readFileSync(inputFile)], 'test_file.png');

    let chunkHashes: Array<{ chunkNumber: number; hash: HashString }> = [];

    worker.addEventListener('message', (event: MessageEvent<UploadWorkerOutgoingMessage | DownloadWorkerOutgoingMessage>) => {
      if (event.data.type === UploadWorkerEventType.Error || event.data.type === DownloadWorkerEventType.Error) {
        console.error('Worker reported error:', event.data);
      }
    });

    const uploadedPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        console.log('Message from worker:', event.data);
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

    expect(chunkHashes.length).toBeGreaterThan(0);
    chunkHashes.sort((a, b) => a.chunkNumber - b.chunkNumber);
    const orderedChunkHashes = chunkHashes.map(entry => entry.hash);

    const downloadedPromise = new Promise<void>((resolve, reject) => {
      const outputStream = fs.createWriteStream(outputFile);
      outputStream.on('error', reject);

      const { port1, port2 } = new MessageChannel();
      if (typeof port2.start === 'function') {
        port2.start();
      }

      const streamPromise = new Promise<void>((streamResolve, streamReject) => {
        let writeChain = Promise.resolve();

        port2.onmessage = (event) => {
          console.log('[integration] port message', event.data instanceof ArrayBuffer ? `ArrayBuffer(${event.data.byteLength})` : event.data);
          const data = event.data;

          if (data instanceof ArrayBuffer) {
            const buffer = Buffer.from(data);
            writeChain = writeChain.then(
              () =>
                new Promise<void>((writeResolve, writeReject) => {
                  outputStream.write(buffer, (error) => {
                    if (error) {
                      writeReject(error);
                    } else {
                      writeResolve();
                    }
                  });
                }),
            );
            return;
          }

          if (data && typeof data === 'object' && 'type' in data) {
            if (data.type === 'close') {
              writeChain
                .then(
                  () =>
                    new Promise<void>((closeResolve, closeReject) => {
                      outputStream.end((err) => {
                        if (err) {
                          closeReject(err);
                        } else {
                          closeResolve();
                        }
                      });
                    }),
                )
                .then(streamResolve)
                .catch(streamReject)
                .finally(() => port2.close());
              return;
            }
            if (data.type === 'abort') {
              const error = new Error(data.error ?? 'Download aborted');
              writeChain
                .then(() => {
                  outputStream.destroy(error);
                  streamReject(error);
                })
                .catch(streamReject)
                .finally(() => port2.close());
              return;
            }
          }
        };
      });

      const workerPromise = new Promise<void>((workerResolve, workerReject) => {
        worker.onmessage = (event: MessageEvent<DownloadWorkerOutgoingMessage>) => {
          console.log('Message from worker:', event.data);
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

      console.log('[integration] posting download start');
      worker.postMessage(
        {
          type: DownloadWorkerCommandType.DownloadStart,
          fileId,
          chunks: orderedChunkHashes,
          destination: port1,
        },
        [port1],
      );

      Promise.all([streamPromise, workerPromise]).then(() => resolve()).catch(reject);
    });

    await downloadedPromise;

    const originalFile = fs.readFileSync(inputFile);
    const downloadedFile = fs.readFileSync(outputFile);

    expect(originalFile.equals(downloadedFile)).toBe(true);

    worker.terminate();
  }, 20000);
});
