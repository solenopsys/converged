const MAX_CHUNK_SIZE = 512 * 1024; // 512KB
const MIN_CHUNK_SIZE = 4 * 1024; // 4KB

export const ChunkSizes = {
  MAX: MAX_CHUNK_SIZE,
  MIN: MIN_CHUNK_SIZE,
} as const;

export type ChunkSelectionOptions = {
  /**
   * When true, the remaining buffer should be emitted even if it is smaller
   * than the minimum chunk size. This is used when the source stream ended.
   */
  allowRemainder?: boolean;
};

/**
 * Calculates the next chunk size for the current compression buffer.
 * The algorithm starts from the maximum chunk size and keeps halving it
 * until it fits the current buffer or the minimum size is reached.
 */
export function buildChunkPlan(
  bufferedBytes: number,
  options: ChunkSelectionOptions = {},
): number {
  if (bufferedBytes <= 0) {
    return 0;
  }

  if (bufferedBytes >= MAX_CHUNK_SIZE) {
    return MAX_CHUNK_SIZE;
  }

  const { allowRemainder = false } = options;
  let candidate = MAX_CHUNK_SIZE;

  while (candidate / 2 >= MIN_CHUNK_SIZE && candidate > bufferedBytes) {
    candidate = Math.floor(candidate / 2);
  }

  if (candidate > bufferedBytes) {
    // Buffer smaller than minimum chunk: emit only when the stream ends.
    return allowRemainder ? bufferedBytes : 0;
  }

  // Avoid producing a chunk that would leave an unreadable tail (< MIN) unless
  // we are allowed to flush the remainder (stream finished).
  const remainingAfterChunk = bufferedBytes - candidate;
  if (!allowRemainder && remainingAfterChunk > 0 && remainingAfterChunk < MIN_CHUNK_SIZE) {
    return 0;
  }

  return candidate;
}

/**
 * Utility used by UI/configuration code that still needs to know how many
 * chunks a file of a given size will produce.
 */
export function estimateChunkCount(totalBytes: number): number {
  if (totalBytes <= 0) {
    return 0;
  }

  let remaining = totalBytes;
  let count = 0;

  while (remaining > 0) {
    const nextSize =
      buildChunkPlan(remaining, { allowRemainder: remaining <= MAX_CHUNK_SIZE }) ||
      remaining;
    remaining -= nextSize;
    count++;
  }

  return count;
}
