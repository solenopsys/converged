import { Worker } from 'worker_threads';
import { readFileSync } from 'fs';

type UploadWorkerIncomingMessage = {
  type: 'UPLOAD_START';
  fileId: string;
  file: File;
  store?: { baseUrl?: string };
  retry?: { attempts: number; delayMs: number };
  maxBufferedChunks?: number;
};

type UploadWorkerOutgoingMessage =
  | { type: 'CHUNK_READY'; fileId: string; chunkNumber: number; chunkSize: number; hash: string }
  | { type: 'UPLOAD_PROGRESS'; fileId: string; bytesProcessed: number; totalBytes: number }
  | { type: 'FILE_UPLOADED'; fileId: string; totalChunks: number }
  | { type: 'UPLOAD_ERROR'; fileId: string; chunkNumber?: number; error: string };

async function testRealFile(filePath: string) {
  console.log(`🧪 Testing with real file: ${filePath}\n`);

  return new Promise<void>((resolve, reject) => {
    const fileBuffer = readFileSync(filePath);
    const blob = new Blob([fileBuffer]);
    const file = new File([blob], filePath.split('/').pop() || 'test.file', {
      type: 'application/octet-stream'
    });

    console.log(`File size: ${file.size} bytes\n`);

    const worker = new Worker('./dist/store.worker.js', {
      type: 'module',
      env: {
        USE_MOCK_STORE: 'true',
        DEBUG_CHUNK_SIZES: 'true'
      }
    });

    const chunks: Array<{ chunkNumber: number; chunkSize: number; hash: string }> = [];
    let hasError = false;
    let lastProgress = 0;

    worker.on('message', (message: UploadWorkerOutgoingMessage) => {
      if (message.type === 'CHUNK_READY') {
        console.log(`  Chunk ${message.chunkNumber}: ${message.chunkSize} bytes, hash: ${message.hash.substring(0, 16)}...`);

        if (message.chunkSize === 0) {
          console.error(`  ❌ ERROR: Empty chunk detected! chunkNumber=${message.chunkNumber}, hash=${message.hash}`);
          hasError = true;
        }

        chunks.push({
          chunkNumber: message.chunkNumber,
          chunkSize: message.chunkSize,
          hash: message.hash,
        });
      } else if (message.type === 'UPLOAD_PROGRESS') {
        const progress = Math.floor((message.bytesProcessed / message.totalBytes) * 100);
        if (progress !== lastProgress && progress % 10 === 0) {
          console.log(`  Progress: ${progress}% (${message.bytesProcessed}/${message.totalBytes} bytes)`);
          lastProgress = progress;
        }
      } else if (message.type === 'FILE_UPLOADED') {
        console.log(`\n  ✓ Upload complete: ${message.totalChunks} chunks`);
        console.log(`\n  Chunk summary:`);
        chunks.forEach((chunk, i) => {
          console.log(`    ${i}: ${chunk.chunkSize} bytes`);
        });

        worker.terminate();

        if (hasError) {
          reject(new Error('Empty chunks detected'));
        } else {
          console.log('\n  ✅ No empty chunks found');
          resolve();
        }
      } else if (message.type === 'UPLOAD_ERROR') {
        console.error(`  ❌ Upload error: ${message.error}`);
        worker.terminate();
        reject(new Error(message.error));
      }
    });

    worker.on('error', (error) => {
      console.error(`  ❌ Worker error:`, error);
      reject(error);
    });

    const uploadMessage: UploadWorkerIncomingMessage = {
      type: 'UPLOAD_START',
      fileId: `test-real-file`,
      file,
      store: { baseUrl: '/services/store' },
    };

    worker.postMessage(uploadMessage);
  });
}

const testFilePath = './test_file.png';

testRealFile(testFilePath).catch((error) => {
  console.error('\nTest failed:', error.message);
  process.exit(1);
});
