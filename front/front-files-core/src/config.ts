const BLOCK_SIZE = 1024 * 1024; // 1MB - ФИКСИРОВАННЫЙ размер блоков для хранилища (сжатые данные)
const COMPRESSION_LEVEL = 1;     // Deflate level 1 - баланс скорости (100 MB/s) и сжатия (~2.5x)
const MAX_PARALLEL_UPLOADS = 3;  // Максимум блоков загружающихся параллельно


export {
  BLOCK_SIZE,
  COMPRESSION_LEVEL,
  MAX_PARALLEL_UPLOADS
};
