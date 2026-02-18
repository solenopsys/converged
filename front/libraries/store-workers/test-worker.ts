// Тест воркера для выявления пустых чанков
import { Worker } from 'worker_threads';

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

async function testWorker() {
  console.log('🧪 Testing store worker for empty chunks...\n');

  // Создаем тестовые файлы разных размеров
  const testCases = [
    { name: 'Tiny file (100 bytes)', size: 100 },
    { name: 'Small file (1 KB)', size: 1024 },
    { name: 'Medium file (100 KB)', size: 100 * 1024 },
    { name: 'Large file (1 MB)', size: 1024 * 1024 },
    { name: 'Very large file (2 MB)', size: 2 * 1024 * 1024 },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    await testFile(testCase.size);
  }

  console.log('\n✅ All tests completed');
}

async function testFile(size: number) {
  return new Promise<void>((resolve, reject) => {
    // Создаем тестовый файл
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const blob = new Blob([data]);
    const file = new File([blob], `test-${size}.bin`, { type: 'application/octet-stream' });

    // Запускаем воркер с mock store
    const worker = new Worker('./dist/store.worker.js', {
      type: 'module',
      env: { USE_MOCK_STORE: 'true' }
    });

    const chunks: Array<{ chunkNumber: number; chunkSize: number; hash: string }> = [];
    let hasError = false;

    worker.on('message', (message: UploadWorkerOutgoingMessage) => {
      if (message.type === 'CHUNK_READY') {
        console.log(`  Chunk ${message.chunkNumber}: ${message.chunkSize} bytes, hash: ${message.hash.substring(0, 16)}...`);

        // ПРОВЕРКА: пустой чанк
        if (message.chunkSize === 0) {
          console.error(`  ❌ ERROR: Empty chunk detected! chunkNumber=${message.chunkNumber}`);
          hasError = true;
        }

        chunks.push({
          chunkNumber: message.chunkNumber,
          chunkSize: message.chunkSize,
          hash: message.hash,
        });
      } else if (message.type === 'UPLOAD_PROGRESS') {
        // Прогресс
      } else if (message.type === 'FILE_UPLOADED') {
        console.log(`  ✓ Upload complete: ${message.totalChunks} chunks`);
        worker.terminate();

        if (hasError) {
          reject(new Error('Empty chunks detected'));
        } else {
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

    // Отправляем файл в воркер
    const uploadMessage: UploadWorkerIncomingMessage = {
      type: 'UPLOAD_START',
      fileId: `test-${size}`,
      file,
      store: { baseUrl: '/services/store' },
    };

    worker.postMessage(uploadMessage);
  });
}

testWorker().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
