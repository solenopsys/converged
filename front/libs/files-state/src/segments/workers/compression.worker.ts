// segments/workers/compression.worker.ts
import { Deflate } from 'fflate';
import type { UUID, HashString } from '../../../../../../types/files';
import type {
  CompressionWorkerIncomingMessage,
  CompressionWorkerOutgoingMessage,
} from './types';

// Конфигурация (копия из config.ts)
const BLOCK_SIZE = 512 * 1024; // 512KB
const COMPRESSION_LEVEL = 3;

// ==========================================
// STATE MANAGEMENT
// ==========================================

type FileState = {
  fileId: UUID;
  file: File;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  deflate: Deflate;
  buffer: Uint8Array;
  blockNumber: number;
  cancelled: boolean;
  bytesProcessed: number;
  totalBytes: number;
  errorCount: number;
  maxErrors: number;
};

const fileQueue: FileState[] = [];
let isProcessing = false;

// ==========================================
// HASH CALCULATION
// ==========================================

async function calculateHash(data: Uint8Array): Promise<HashString> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex as HashString;
}

// ==========================================
// MESSAGE HANDLER
// ==========================================

self.onmessage = async (event: MessageEvent<CompressionWorkerIncomingMessage>) => {
  const message = event.data;

  console.log('[CompressionWorker] Received message:', message.type, message);

  switch (message.type) {
    case 'ADD_FILE': {
      console.log('[CompressionWorker] ADD_FILE:', {
        fileId: message.fileId,
        fileName: message.file.name,
        fileSize: message.file.size,
        maxBufferedChunks: message.maxBufferedChunks
      });

      const reader = message.file.stream().getReader();
      const deflate = new Deflate({ level: COMPRESSION_LEVEL });
      
      const fileState: FileState = {
        fileId: message.fileId,
        file: message.file,
        reader,
        deflate,
        buffer: new Uint8Array(0),
        blockNumber: 0,
        cancelled: false,
        bytesProcessed: 0,
        totalBytes: message.file.size,
        errorCount: 0,
        maxErrors: 3,
      };

      fileQueue.push(fileState);
      console.log('[CompressionWorker] File added to queue. Queue length:', fileQueue.length);

      if (!isProcessing) {
        console.log('[CompressionWorker] Starting processQueue...');
        processQueue();
      } else {
        console.log('[CompressionWorker] Already processing');
      }
      break;
    }

    case 'CHUNK_CONSUMED': {
      // Больше не нужно - backpressure убран
      break;
    }

    case 'PAUSE_FILE': {
      // TODO: implement pause
      break;
    }

    case 'RESUME_FILE': {
      // TODO: implement resume
      break;
    }

    case 'CANCEL_FILE': {
      console.log('[CompressionWorker] CANCEL_FILE:', message.fileId);
      const fileState = fileQueue.find(f => f.fileId === message.fileId);
      if (fileState) {
        fileState.cancelled = true;
        await fileState.reader.cancel();
      }
      break;
    }
  }
};

// ==========================================
// QUEUE PROCESSING (Round-Robin)
// ==========================================

async function processQueue() {
  isProcessing = true;
  console.log('[CompressionWorker] processQueue started. Queue length:', fileQueue.length);

  while (fileQueue.length > 0) {
    const fileState = fileQueue[0];

    console.log('[CompressionWorker] Processing file:', {
      fileId: fileState.fileId,
      fileName: fileState.file.name,
      cancelled: fileState.cancelled,
      bytesProcessed: fileState.bytesProcessed,
      totalBytes: fileState.totalBytes,
      blockNumber: fileState.blockNumber,
      errorCount: fileState.errorCount
    });

    if (fileState.cancelled) {
      console.log('[CompressionWorker] File cancelled, removing:', fileState.fileId);
      fileQueue.shift();
      continue;
    }

    // Проверка лимита ошибок
    if (fileState.errorCount >= fileState.maxErrors) {
      console.error('[CompressionWorker] Max errors reached, aborting file:', fileState.fileId);
      sendError(fileState, new Error(`Max error limit (${fileState.maxErrors}) reached`));
      fileQueue.shift();
      continue;
    }

    try {
      // Читаем следующий кусок из stream
      const { value, done } = await fileState.reader.read();
      console.log('[CompressionWorker] Stream read result:', {
        fileId: fileState.fileId,
        hasValue: !!value,
        valueSize: value?.length,
        done
      });

      if (value) {
        fileState.bytesProcessed += value.length;

        console.log('[CompressionWorker] Compressing data...', {
          fileId: fileState.fileId,
          dataSize: value.length,
          bytesProcessed: fileState.bytesProcessed
        });

        // Компрессируем данные
        await compressData(fileState, value, done);

        // Сбрасываем счетчик ошибок при успешной обработке
        fileState.errorCount = 0;

        // Отправляем прогресс каждые 1MB
        if (fileState.bytesProcessed % (1024 * 1024) < value.length) {
          sendProgress(fileState);
        }
      }

      if (done) {
        console.log('[CompressionWorker] File reading complete:', fileState.fileId);
        // Файл полностью прочитан
        await finalizeFile(fileState);
        fileQueue.shift();
      }
    } catch (error) {
      console.error('[CompressionWorker] Error processing file:', fileState.fileId, error);
      fileState.errorCount++;
      
      // Если достигнут лимит ошибок - удаляем файл из очереди
      if (fileState.errorCount >= fileState.maxErrors) {
        sendError(fileState, error);
        fileQueue.shift();
      } else {
        console.warn('[CompressionWorker] Error occurred, will retry...', {
          fileId: fileState.fileId,
          errorCount: fileState.errorCount,
          maxErrors: fileState.maxErrors
        });
        // Экспоненциальная задержка перед повтором
        await new Promise(resolve => setTimeout(resolve, 1000 * fileState.errorCount));
      }
    }
  }

  console.log('[CompressionWorker] processQueue finished. Queue empty.');
  isProcessing = false;
}

// ==========================================
// COMPRESSION LOGIC
// ==========================================

async function compressData(
  fileState: FileState,
  data: Uint8Array,
  final: boolean
): Promise<void> {
  console.log('[CompressionWorker] compressData called:', {
    fileId: fileState.fileId,
    dataSize: data.length,
    final
  });

  return new Promise((resolve, reject) => {
    fileState.deflate.ondata = (compressed, isFinal) => {
      console.log('[CompressionWorker] Deflate ondata:', {
        fileId: fileState.fileId,
        compressedSize: compressed.length,
        isFinal,
        currentBufferSize: fileState.buffer.length
      });

      // Добавляем сжатые данные в буфер
      const newBuffer = new Uint8Array(fileState.buffer.length + compressed.length);
      newBuffer.set(fileState.buffer);
      newBuffer.set(compressed, fileState.buffer.length);
      fileState.buffer = newBuffer;

      console.log('[CompressionWorker] Buffer updated. New size:', fileState.buffer.length);

      // Проверяем, нужно ли отправить chunk
      processBuffer(fileState, isFinal);

      resolve();
    };

    try {
      console.log('[CompressionWorker] Pushing data to deflate...');
      fileState.deflate.push(data, final);
    } catch (error) {
      console.error('[CompressionWorker] Deflate error:', error);
      reject(error);
    }
  });
}

// ==========================================
// BUFFER PROCESSING
// ==========================================

function processBuffer(fileState: FileState, final: boolean) {
  console.log('[CompressionWorker] processBuffer:', {
    fileId: fileState.fileId,
    bufferSize: fileState.buffer.length,
    blockSize: BLOCK_SIZE,
    final,
    blockNumber: fileState.blockNumber
  });

  // Отправляем полные chunks
  while (fileState.buffer.length >= BLOCK_SIZE) {
    const currentChunkNumber = fileState.blockNumber;
    
    console.log('[CompressionWorker] Sending full chunk:', {
      fileId: fileState.fileId,
      blockNumber: currentChunkNumber,
      chunkSize: BLOCK_SIZE
    });

    const chunkData = fileState.buffer.slice(0, BLOCK_SIZE);
    fileState.buffer = fileState.buffer.slice(BLOCK_SIZE);
    
    sendChunk(fileState, chunkData, currentChunkNumber);
    fileState.blockNumber++;
  }

  // Если это последний кусок и есть остаток - отправляем его
  if (final && fileState.buffer.length > 0) {
    const currentChunkNumber = fileState.blockNumber;
    
    console.log('[CompressionWorker] Sending final chunk:', {
      fileId: fileState.fileId,
      blockNumber: currentChunkNumber,
      chunkSize: fileState.buffer.length
    });

    const chunkData = fileState.buffer;
    fileState.buffer = new Uint8Array(0);
    
    sendChunk(fileState, chunkData, currentChunkNumber);
    fileState.blockNumber++;
  }
}

// ==========================================
// FINALIZATION
// ==========================================

async function finalizeFile(fileState: FileState) {
  console.log('[CompressionWorker] Finalizing file:', {
    fileId: fileState.fileId,
    totalChunks: fileState.blockNumber
  });

  const message: CompressionWorkerOutgoingMessage = {
    type: 'FILE_COMPLETE',
    fileId: fileState.fileId,
    totalChunks: fileState.blockNumber,
  };

  self.postMessage(message);
  console.log('[CompressionWorker] FILE_COMPLETE message sent:', message);
}

// ==========================================
// MESSAGE SENDERS
// ==========================================

async function sendChunk(fileState: FileState, data: Uint8Array, chunkNumber: number) {
  console.log('[CompressionWorker] Calculating hash for chunk:', {
    fileId: fileState.fileId,
    chunkNumber: chunkNumber,
    dataSize: data.length
  });

  const hash = await calculateHash(data);

  console.log('[CompressionWorker] Hash calculated:', {
    fileId: fileState.fileId,
    chunkNumber: chunkNumber,
    hash
  });

  const message: CompressionWorkerOutgoingMessage = {
    type: 'CHUNK_READY',
    fileId: fileState.fileId,
    chunkNumber: chunkNumber,
    data,
    hash,
  };

  // Transfer ownership для производительности
  self.postMessage(message, [data.buffer]);

  console.log('[CompressionWorker] CHUNK_READY message sent:', {
    fileId: fileState.fileId,
    chunkNumber: chunkNumber,
    hash,
    dataSize: data.length
  });
}

function sendProgress(fileState: FileState) {
  const message: CompressionWorkerOutgoingMessage = {
    type: 'PROGRESS',
    fileId: fileState.fileId,
    bytesProcessed: fileState.bytesProcessed,
    totalBytes: fileState.totalBytes,
  };

  console.log('[CompressionWorker] PROGRESS:', {
    fileId: fileState.fileId,
    bytesProcessed: fileState.bytesProcessed,
    totalBytes: fileState.totalBytes,
    percentage: ((fileState.bytesProcessed / fileState.totalBytes) * 100).toFixed(2) + '%'
  });

  self.postMessage(message);
}

function sendError(fileState: FileState, error: unknown) {
  console.error('[CompressionWorker] ERROR:', {
    fileId: fileState.fileId,
    error
  });

  const message: CompressionWorkerOutgoingMessage = {
    type: 'ERROR',
    fileId: fileState.fileId,
    error: error instanceof Error ? error.message : String(error),
  };

  self.postMessage(message);
}
