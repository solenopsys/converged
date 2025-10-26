import { buildChunkPlan, ChunkSizes, estimateChunkCount } from './chunk-split';

describe('buildChunkPlan (next chunk selector)', () => {
  it('returns 0 for empty buffers', () => {
    expect(buildChunkPlan(0)).toBe(0);
    expect(buildChunkPlan(-100)).toBe(0);
  });

  it('returns max chunk when enough data buffered', () => {
    expect(buildChunkPlan(ChunkSizes.MAX)).toBe(ChunkSizes.MAX);
    expect(buildChunkPlan(ChunkSizes.MAX * 2)).toBe(ChunkSizes.MAX);
  });

  it('halves chunk size until it fits the buffer', () => {
    const nextChunk = buildChunkPlan(ChunkSizes.MAX / 2);
    expect(nextChunk).toBe(ChunkSizes.MAX / 2);
  });

  it('waits for more data when remainder would be below minimum', () => {
    const almostFull = ChunkSizes.MAX + ChunkSizes.MIN - 1;
    // First chunk should be max size, leaving < MIN remainder, so the next call without allowRemainder returns 0
    expect(buildChunkPlan(almostFull)).toBe(ChunkSizes.MAX);
    expect(buildChunkPlan(almostFull - ChunkSizes.MAX)).toBe(0);
  });

  it('flushes small remainder when allowed', () => {
    const tail = ChunkSizes.MIN - 512;
    expect(buildChunkPlan(tail)).toBe(0);
    expect(buildChunkPlan(tail, { allowRemainder: true })).toBe(tail);
  });
});

describe('estimateChunkCount', () => {
  it('returns 0 for non-positive sizes', () => {
    expect(estimateChunkCount(0)).toBe(0);
    expect(estimateChunkCount(-10)).toBe(0);
  });

  it('counts chunks according to the selection algorithm', () => {
    const size = 600 * 1024;
    const expected = 2; // 512k + remainder
    expect(estimateChunkCount(size)).toBe(expected);
  });

  it('handles values around halving thresholds', () => {
    const size = 514 * 1024;
    expect(estimateChunkCount(size)).toBeGreaterThan(2);
  });
});
