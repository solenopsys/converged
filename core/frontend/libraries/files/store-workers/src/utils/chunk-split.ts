const MAX_CHUNK_SIZE = 512 * 1024; // 512KB
const MIN_CHUNK_SIZE = 4 * 1024; // 4KB

export const ChunkSizes = {
  MAX: MAX_CHUNK_SIZE,
  MIN: MIN_CHUNK_SIZE,
} as const;

export type ChunkSelectionOptions = {

  allowRemainder?: boolean;
};


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
