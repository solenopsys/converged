import { combine } from 'effector';
import {
  $files,
  $chunks,
  type FileUploadState,
  type ChunkState,
} from './files';
import {
  pauseUpload,
  resumeUpload,
  cancelUpload,
  retryChunk,
  downloadRequested,
} from './browser';

export type FileViewStatus = 'uploading' | 'paused' | 'error' | 'uploaded';

export interface FileListItem {
  fileId: string;
  name?: string;
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
  status: FileViewStatus;
  failedChunk?: number | null;
  retriesLeft?: number;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
  disablePause?: boolean;
  disableResume?: boolean;
  disableCancel?: boolean;
  disableRetry?: boolean;
  disableDownload?: boolean;
}

const mapStatus = (file: FileUploadState, hasFailedChunk: boolean): FileViewStatus => {
  if (hasFailedChunk || file.status === 'failed') {
    return 'error';
  }

  if (file.status === 'paused') {
    return 'paused';
  }

  if (file.status === 'completed') {
    return 'uploaded';
  }

  return 'uploading';
};

const collectChunks = (chunks: Map<string, ChunkState>, fileId: string) => {
  return Array.from(chunks.values()).filter((chunk) => chunk.fileId === fileId);
};

/**
 * Готовый стор с данными для UI-списка файлов.
 * Содержит все необходимое для отображения прогресса и управления загрузкой.
 */
export const $fileListItems = combine($files, $chunks, (files, chunks): FileListItem[] => {
  return Array.from(files.values()).map((file) => {
    const fileChunks = collectChunks(chunks, file.fileId);
    const uploadedChunks = file.uploadedChunks;
    const failedChunk = fileChunks.find((chunk) => chunk.status === 'failed');
    const observedChunks = fileChunks.reduce(
      (max, chunk) => Math.max(max, chunk.chunkNumber + 1),
      fileChunks.length
    );
    const totalChunksValue = file.totalChunks ?? (observedChunks > 0 ? observedChunks : 0);
    const effectiveTotal = totalChunksValue || (uploadedChunks > 0 ? uploadedChunks : observedChunks);
    const progress = file.status === 'completed'
      ? 100
      : effectiveTotal > 0
        ? Math.min(100, Math.round((uploadedChunks / effectiveTotal) * 100))
        : 0;
    const canDownload = file.status === 'completed';

    return {
      fileId: file.fileId,
      name: file.fileName,
      progress,
      uploadedChunks,
      totalChunks: totalChunksValue,
      status: mapStatus(file, Boolean(failedChunk)),
      failedChunk: failedChunk?.chunkNumber ?? null,
      retriesLeft: undefined,
      onPause: file.status === 'uploading' ? () => pauseUpload(file.fileId) : undefined,
      onResume: file.status === 'paused' ? () => resumeUpload(file.fileId) : undefined,
      onCancel: file.status === 'completed' ? undefined : () => cancelUpload(file.fileId),
      onRetry: failedChunk ? () => retryChunk({ fileId: file.fileId, chunkNumber: failedChunk.chunkNumber }) : undefined,
      disablePause: file.status !== 'uploading',
      disableResume: file.status !== 'paused',
      disableCancel: file.status === 'completed',
      disableRetry: !failedChunk,
      onDownload: canDownload
        ? () => downloadRequested({ fileId: file.fileId, fileName: file.fileName })
        : undefined,
      disableDownload: !canDownload,
    };
  });
});

/**
 * Количество активных загрузок
 */
export const $activeUploadsCount = $files.map(files =>
  Array.from(files.values()).filter(f => f.status === 'uploading' || f.status === 'compressing').length
);

/**
 * Есть ли файлы с ошибками
 */
export const $hasFailedUploads = $files.map(files =>
  Array.from(files.values()).some(f => f.status === 'failed')
);

/**
 * Общий прогресс всех загрузок (0-100)
 */
export const $totalProgress = $files.map((files): number => {
  const activeFiles = Array.from(files.values()).filter(
    f => f.status === 'uploading' || f.status === 'compressing' || f.status === 'completed'
  );

  if (activeFiles.length === 0) return 0;

  let totalChunks = 0;
  let uploadedChunks = 0;

  for (const file of activeFiles) {
    const total = file.totalChunks ?? file.uploadedChunks;
    totalChunks += total;
    uploadedChunks += file.uploadedChunks;
  }

  return totalChunks > 0 ? Math.round((uploadedChunks / totalChunks) * 100) : 0;
});
