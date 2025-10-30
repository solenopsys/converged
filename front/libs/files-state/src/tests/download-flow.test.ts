import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { allSettled, fork } from 'effector';
import { HashString, UUID } from '../../../types/files';
import { $fileMetadataCache, $fileChunkHashes } from '../segments/files';
import { blockLoadRequested } from '../segments/store';
import { services } from '../services';

const createStubWorker = () => ({
  postMessage: () => {},
  terminate: () => {},
  onmessage: null as ((event: MessageEvent) => void) | null,
  onerror: null as ((event: Event) => void) | null,
});

mock.module('../segments/workers/compression.worker.ts', () => ({
  createWorker: () => createStubWorker(),
}));

mock.module('../segments/workers/decompression.worker.ts', () => ({
  createWorker: () => createStubWorker(),
}));

let decompressionStarted: typeof import('../segments/streaming').decompressionStarted;
let decompressionChunkProcessed: typeof import('../segments/streaming').decompressionChunkProcessed;
let decompressionCompleted: typeof import('../segments/streaming').decompressionCompleted;

beforeAll(async () => {
  services.setFilesService({
    save: async () => ({}),
    saveChunk: async () => ({}),
    get: async () => ({}),
    getChunks: async () => [],
    update: async () => ({}),
    delete: async () => ({}),
    list: async () => ({ items: [] }),
    statistic: async () => ({}),
  } as any);

  services.setStoreService({
    save: async () => 'hash' as HashString,
    get: async () => new Uint8Array([0]),
    delete: async () => {},
    list: async () => ({ items: [] }),
    storeStatistic: async () => ({}),
  } as any);

  await import('../integrations');
  const streaming = await import('../segments/streaming');
  ({ decompressionStarted, decompressionChunkProcessed, decompressionCompleted } = streaming);
});

describe('download flow', () => {
  test('requests every chunk sequentially before completing', async () => {
    const fileId = 'download-test' as UUID;
    const chunkCount = 4;

    const metadata = {
      id: fileId,
      hash: 'hash' as HashString,
      status: 'uploaded' as const,
      name: 'test.bin',
      fileSize: 1024,
      fileType: 'application/octet-stream',
      compression: 'deflate',
      owner: 'tester',
      createdAt: new Date().toISOString(),
      chunksCount: chunkCount,
    };

    const chunkHashes = new Map<number, HashString>(
      Array.from({ length: chunkCount }, (_, index) => [index, `hash-${index}` as HashString])
    );

    const scope = fork({
      values: [
        [$fileMetadataCache, new Map([[fileId, metadata]])],
        [$fileChunkHashes, new Map([[fileId, chunkHashes]])],
      ],
    });

    const requestedChunks: Array<{ fileId: UUID; chunkNumber: number }> = [];
    const blockWatcher = blockLoadRequested.watch((payload) => {
      requestedChunks.push(payload);
    });

    const completion: UUID[] = [];
    const completionWatcher = decompressionCompleted.watch((id) => {
      completion.push(id);
    });

    await allSettled(decompressionStarted, {
      scope,
      params: { fileId },
    });

    expect(requestedChunks).toEqual([{ fileId, chunkNumber: 0, hash: 'hash-0' as HashString }]);

    for (let chunkNumber = 0; chunkNumber < chunkCount; chunkNumber += 1) {
      await allSettled(decompressionChunkProcessed, {
        scope,
        params: {
          fileId,
          chunkNumber,
          decompressed: new Uint8Array([chunkNumber]),
        },
      });
    }

    expect(requestedChunks.map((item) => item.chunkNumber)).toEqual([0, 1, 2, 3]);
    expect(completion).toEqual([fileId]);

    blockWatcher();
    completionWatcher();
  });
});
