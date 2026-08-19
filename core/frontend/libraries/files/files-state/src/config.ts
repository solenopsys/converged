import { buildChunkPlan } from './utils/chunk-split';

// segments/config.ts

// COMPRESSION SETTINGS


export const MAX_BLOCK_SIZE = 512 * 1024; // 512KB


export const MIN_BLOCK_SIZE = 4 * 1024; // 4KB


export const BLOCK_SIZE = MAX_BLOCK_SIZE;


export const COMPRESSION_LEVEL = 3;

// UPLOAD SETTINGS


export const MAX_PARALLEL_UPLOADS = 1;


export const MAX_RETRY_ATTEMPTS = 1;


export const MAX_BUFFERED_CHUNKS = 5;

// WORKER SETTINGS


export const PROGRESS_UPDATE_INTERVAL = 200;


export const MAX_ACTIVE_FILES_IN_WORKER = 3;

// NETWORK SETTINGS


export const REQUEST_TIMEOUT = 30000;

// CACHE SETTINGS


export const MAX_BLOCK_CACHE_SIZE = 50 * 1024 * 1024; // 50MB


export const BLOCK_CACHE_TTL = 5 * 60 * 1000;
// UI SETTINGS


export const UI_UPDATE_DEBOUNCE = 100;


export const MAX_FILES_IN_UI = 10;

// HELPERS


export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}


export function calculateTotalChunks(fileSize: number): number {
  return buildChunkPlan(fileSize).length;
}


export function calculateETA(
  uploadedChunks: number,
  totalChunks: number,
  elapsedTime: number
): number {
  if (uploadedChunks === 0) return 0;
  const avgTimePerChunk = elapsedTime / uploadedChunks;
  const remainingChunks = totalChunks - uploadedChunks;
  return Math.round(avgTimePerChunk * remainingChunks);
}


export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
