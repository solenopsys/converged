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

  it('counts chunks for file larger than max chunk', () => {
    const size = 600 * 1024; // 600KB
    // 512KB + 88KB remainder (which splits into smaller chunks)
    const count = estimateChunkCount(size);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('handles file slightly larger than max chunk', () => {
    const size = 514 * 1024; // slightly more than 512KB
    const count = estimateChunkCount(size);
    // 512KB + 2KB remainder
    expect(count).toBe(2);
  });

  it('returns 1 for small files', () => {
    expect(estimateChunkCount(1024)).toBe(1);
    expect(estimateChunkCount(ChunkSizes.MIN)).toBe(1);
  });
});
