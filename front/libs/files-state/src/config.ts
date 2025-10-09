// segments/config.ts
// Централизованная конфигурация для file transfer системы

// ==========================================
// COMPRESSION SETTINGS
// ==========================================

/**
 * Размер одного chunk после компрессии (в байтах)
 * 256KB - баланс между количеством HTTP requests и размером payload
 */
export const BLOCK_SIZE = 1024 * 1024; // 1024KB

/**
 * Уровень компрессии Deflate (1-9)
 * 1 = быстрее, меньше сжатие
 * 9 = медленнее, лучше сжатие
 * 6 = оптимальный баланс
 */
export const COMPRESSION_LEVEL = 3;

// ==========================================
// UPLOAD SETTINGS
// ==========================================

/**
 * Максимальное количество параллельных upload запросов
 */
export const MAX_PARALLEL_UPLOADS = 1;

/**
 * Максимальное количество попыток загрузки chunk при ошибке
 */
export const MAX_RETRY_ATTEMPTS = 1;

/**
 * Максимальное количество chunks в памяти на файл (backpressure)
 * Worker остановится если накопится больше chunks чем этот лимит
 */
export const MAX_BUFFERED_CHUNKS = 5;

// ==========================================
// WORKER SETTINGS
// ==========================================

/**
 * Интервал отправки progress events из worker (мс)
 */
export const PROGRESS_UPDATE_INTERVAL = 200;

/**
 * Максимальное количество активно обрабатываемых файлов в worker
 * (для Hybrid стратегии в compression worker)
 */
export const MAX_ACTIVE_FILES_IN_WORKER = 3;

// ==========================================
// NETWORK SETTINGS
// ==========================================

/**
 * Timeout для network requests (мс)
 */
export const REQUEST_TIMEOUT = 30000; // 30 секунд

 
// ==========================================
// CACHE SETTINGS
// ==========================================

/**
 * Максимальный размер block cache в памяти (байты)
 */
export const MAX_BLOCK_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Time-to-live для cached blocks (мс)
 */
export const BLOCK_CACHE_TTL = 5 * 60 * 1000; // 5 минут

// ==========================================
// UI SETTINGS
// ==========================================

/**
 * Debounce интервал для UI updates (мс)
 * Прогресс-бар не будет обновляться чаще чем этот интервал
 */
export const UI_UPDATE_DEBOUNCE = 100;

/**
 * Максимальное количество файлов для одновременного отображения прогресса
 */
export const MAX_FILES_IN_UI = 10;

// ==========================================
// HELPERS
// ==========================================

/**
 * Конвертировать байты в человекочитаемый формат
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Рассчитать количество chunks для файла
 */
export function calculateTotalChunks(fileSize: number): number {
  return Math.ceil(fileSize / BLOCK_SIZE);
}

/**
 * Рассчитать ETA (estimated time of arrival)
 */
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

/**
 * Форматировать время в человекочитаемый формат
 */
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