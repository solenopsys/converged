/**
 * Worker Mock - симулирует реальное поведение воркера
 *
 * Использование:
 * const mock = new WorkerMock();
 * mock.simulateUpload(fileId, file);
 */

export enum UploadWorkerEventType {
  UploadProgress = 'UPLOAD_PROGRESS',
  ChunkReady = 'CHUNK_READY',
  FileUploaded = 'FILE_UPLOADED',
  Error = 'ERROR',
}

export interface UploadProgressEvent {
  type: UploadWorkerEventType.UploadProgress;
  fileId: string;
  bytesProcessed: number;
  totalBytes: number;
}

export interface ChunkReadyEvent {
  type: UploadWorkerEventType.ChunkReady;
  fileId: string;
  chunkNumber: number;
  chunkSize: number;
  hash: string;
}

export interface FileUploadedEvent {
  type: UploadWorkerEventType.FileUploaded;
  fileId: string;
  totalChunks: number;
}

export interface ErrorEvent {
  type: UploadWorkerEventType.Error;
  fileId: string;
  error: string;
}

export type WorkerMessage = UploadProgressEvent | ChunkReadyEvent | FileUploadedEvent | ErrorEvent;

export class WorkerMock {
  private listeners: Array<(message: WorkerMessage) => void> = [];

  /**
   * Подписка на сообщения воркера
   */
  onMessage(listener: (message: WorkerMessage) => void) {
    this.listeners.push(listener);
  }

  /**
   * Отправка сообщения всем слушателям
   */
  private postMessage(message: WorkerMessage) {
    this.listeners.forEach(listener => listener(message));
  }

  /**
   * Симуляция загрузки файла
   * Имитирует реальное поведение воркера:
   * 1. UPLOAD_PROGRESS (0%)
   * 2. CHUNK_READY (chunk 0)
   * 3. UPLOAD_PROGRESS (50%)
   * 4. CHUNK_READY (chunk 1)
   * 5. UPLOAD_PROGRESS (100%)
   * 6. FILE_UPLOADED
   */
  async simulateUpload(fileId: string, file: File) {
    const totalBytes = file.size;
    const chunkSize = Math.ceil(totalBytes / 2); // 2 чанка для теста

    // Прогресс 0%
    this.postMessage({
      type: UploadWorkerEventType.UploadProgress,
      fileId,
      bytesProcessed: 0,
      totalBytes,
    });

    // Даем время на обработку
    await this.delay(10);

    // Чанк 0 готов
    this.postMessage({
      type: UploadWorkerEventType.ChunkReady,
      fileId,
      chunkNumber: 0,
      chunkSize,
      hash: this.generateHash(fileId, 0),
    });

    await this.delay(10);

    // Прогресс 50%
    this.postMessage({
      type: UploadWorkerEventType.UploadProgress,
      fileId,
      bytesProcessed: chunkSize,
      totalBytes,
    });

    await this.delay(10);

    // Чанк 1 готов
    this.postMessage({
      type: UploadWorkerEventType.ChunkReady,
      fileId,
      chunkNumber: 1,
      chunkSize,
      hash: this.generateHash(fileId, 1),
    });

    await this.delay(10);

    // Прогресс 100%
    this.postMessage({
      type: UploadWorkerEventType.UploadProgress,
      fileId,
      bytesProcessed: totalBytes,
      totalBytes,
    });

    await this.delay(10);

    // Файл загружен
    this.postMessage({
      type: UploadWorkerEventType.FileUploaded,
      fileId,
      totalChunks: 2,
    });
  }

  /**
   * Генерация фейкового хеша для теста
   */
  private generateHash(fileId: string, chunkNumber: number): string {
    // Простой детерминированный хеш для тестов
    return `hash_${fileId}_chunk_${chunkNumber}`;
  }

  /**
   * Задержка для имитации асинхронности
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Очистка слушателей
   */
  clear() {
    this.listeners = [];
  }
}
