import { buildChunkPlan, ChunkSizes } from '../utils/chunk-split';

describe('buildChunkPlan', () => {
  test('returns empty plan for non-positive sizes', () => {
    expect(buildChunkPlan(0)).toEqual([]);
    expect(buildChunkPlan(-1024)).toEqual([]);
  });

  test('returns single chunk when size below minimum', () => {
    const smallSize = ChunkSizes.MIN - 512;
    expect(buildChunkPlan(smallSize)).toEqual([smallSize]);
  });

  test('returns single max-sized chunk for exact boundary', () => {
    expect(buildChunkPlan(ChunkSizes.MAX)).toEqual([ChunkSizes.MAX]);
  });

  test('splits size with large remainder into max-sized chunk and tail', () => {
    const plan = buildChunkPlan(600 * 1024);
    expect(plan[0]).toBe(ChunkSizes.MAX);
    expect(plan[1]).toBe(600 * 1024 - ChunkSizes.MAX);
    expect(plan.reduce((acc, chunk) => acc + chunk, 0)).toBe(600 * 1024);
  });

  test('dynamically halves towards the end for near-boundary files', () => {
    const plan = buildChunkPlan(514 * 1024);

    expect(plan[0]).toBe(ChunkSizes.MAX / 2);
    expect(plan.slice(-1)[0]).toBe(10 * 1024);
    expect(plan.reduce((acc, chunk) => acc + chunk, 0)).toBe(514 * 1024);

    for (const chunk of plan) {
      expect(chunk).toBeGreaterThanOrEqual(ChunkSizes.MIN);
      expect(chunk).toBeLessThanOrEqual(ChunkSizes.MAX);
    }
  });
});
