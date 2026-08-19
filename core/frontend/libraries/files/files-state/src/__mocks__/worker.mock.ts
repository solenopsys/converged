

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


  onMessage(listener: (message: WorkerMessage) => void) {
    this.listeners.push(listener);
  }


  private postMessage(message: WorkerMessage) {
    this.listeners.forEach(listener => listener(message));
  }


  async simulateUpload(fileId: string, file: File) {
    const totalBytes = file.size;
    const chunkSize = Math.ceil(totalBytes / 2);
    this.postMessage({
      type: UploadWorkerEventType.UploadProgress,
      fileId,
      bytesProcessed: 0,
      totalBytes,
    });

    await this.delay(10);

    this.postMessage({
      type: UploadWorkerEventType.ChunkReady,
      fileId,
      chunkNumber: 0,
      chunkSize,
      hash: this.generateHash(fileId, 0),
    });

    await this.delay(10);

    this.postMessage({
      type: UploadWorkerEventType.UploadProgress,
      fileId,
      bytesProcessed: chunkSize,
      totalBytes,
    });

    await this.delay(10);

    this.postMessage({
      type: UploadWorkerEventType.ChunkReady,
      fileId,
      chunkNumber: 1,
      chunkSize,
      hash: this.generateHash(fileId, 1),
    });

    await this.delay(10);

    this.postMessage({
      type: UploadWorkerEventType.UploadProgress,
      fileId,
      bytesProcessed: totalBytes,
      totalBytes,
    });

    await this.delay(10);

    this.postMessage({
      type: UploadWorkerEventType.FileUploaded,
      fileId,
      totalChunks: 2,
    });
  }


  private generateHash(fileId: string, chunkNumber: number): string {
    return `hash_${fileId}_chunk_${chunkNumber}`;
  }


  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  clear() {
    this.listeners = [];
  }
}
