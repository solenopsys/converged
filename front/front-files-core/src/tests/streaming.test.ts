import { allSettled, fork } from 'effector';
import {
  compressionStarted,
  $compressionState,
  chunkPrepared,
  compressionCompleted,
  setDecompressionChunks,
  $decompressionState
} from '../segments/streaming';

describe('streaming module', () => {
  test('should initialize compression state', async () => {
    const scope = fork();
    
    const file = new File(['test content'], 'test.txt');
    const fileId = 'test-uuid' as any;

    await allSettled(compressionStarted, {
      scope,
      params: {
        fileId,
        file
      }
    });

    const state = scope.getState($compressionState);
    expect(state.has(fileId)).toBe(true);
    expect(state.get(fileId)?.blockNumber).toBe(0);
  });

  test('should set decompression chunks', async () => {
    const scope = fork();
    
    const fileId = 'test-uuid' as any;
    const chunks = [
      {
        fileId,
        hash: 'hash1' as any,
        chunkNumber: 0,
        chunkSize: 1024,
        createdAt: new Date().toISOString()
      },
      {
        fileId,
        hash: 'hash2' as any,
        chunkNumber: 1,
        chunkSize: 1024,
        createdAt: new Date().toISOString()
      }
    ];

    await allSettled(setDecompressionChunks, {
      scope,
      params: {
        fileId,
        chunks
      }
    });

    const state = scope.getState($decompressionState);
    expect(state.has(fileId)).toBe(true);
    expect(state.get(fileId)?.totalChunks).toBe(2);
    expect(state.get(fileId)?.chunks).toHaveLength(2);
  });
});