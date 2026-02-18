const MAX_CHUNK_SIZE = 512 * 1024;
const MIN_CHUNK_SIZE = 4 * 1024;

export type ChunkPlan = number[];

export function buildChunkPlan(fileSize: number): ChunkPlan {
  if (fileSize <= 0) {
    return [];
  }

  if (fileSize <= MIN_CHUNK_SIZE) {
    return [fileSize];
  }

  const plan: number[] = [];
  let remaining = fileSize;
  let currentSize = MAX_CHUNK_SIZE;

  while (remaining > 0) {
    if (remaining <= currentSize && remaining >= MIN_CHUNK_SIZE) {
      plan.push(remaining);
      remaining = 0;
      break;
    }

    if (remaining - currentSize >= MIN_CHUNK_SIZE) {
      plan.push(currentSize);
      remaining -= currentSize;
      continue;
    }

    if (currentSize > MIN_CHUNK_SIZE && currentSize / 2 >= MIN_CHUNK_SIZE) {
      currentSize = Math.floor(currentSize / 2);
      continue;
    }

    const merged = remaining;
    if (plan.length === 0) {
      plan.push(merged);
    } else {
      const lastIndex = plan.length - 1;
      const last = plan[lastIndex];
      const newLast = last + merged;
      if (newLast <= MAX_CHUNK_SIZE) {
        plan[lastIndex] = newLast;
      } else {
        plan.push(merged);
      }
    }
    remaining = 0;
    break;
  }

  return plan;
}

export const ChunkSizes = {
  MAX: MAX_CHUNK_SIZE,
  MIN: MIN_CHUNK_SIZE,
} as const;
