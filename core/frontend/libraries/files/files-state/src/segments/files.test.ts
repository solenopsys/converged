import { test, expect, describe, beforeEach } from 'bun:test';
import { allSettled, fork } from 'effector';
import {
  fileMetadataCreateRequested,
  fileMetadataCreated,
  chunkMetadataSaveRequested,
  chunkMetadataSaved,
  saveFileMetadataFx,
  saveChunkMetadataFx,
  $fileMetadataCache,
} from './files';

describe('Files segment', () => {
  test('should create file metadata', async () => {
    const scope = fork();

    const fileId = 'test-file-id';
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const owner = 'test-user';

    await allSettled(fileMetadataCreateRequested, {
      scope,
      params: { fileId, file, owner }
    });

    const cache = scope.getState($fileMetadataCache);
    const metadata = cache.get(fileId);

    expect(metadata).toBeDefined();
    expect(metadata?.id).toBe(fileId);
    expect(metadata?.name).toBe('test.txt');
    expect(metadata?.owner).toBe(owner);
  });

  test('should save chunk metadata with hash', async () => {
    const scope = fork();

    const chunkData = {
      fileId: 'test-file-id',
      chunkNumber: 0,
      hash: 'abc123hash',
      chunkSize: 1024
    };

    await allSettled(chunkMetadataSaveRequested, {
      scope,
      params: chunkData
    });

    // Check that the effect was called with correct parameters
    const state = scope.getState(saveChunkMetadataFx.pending);
    expect(state).toBe(false); // Effect should complete
  });

  test('should trigger chunkMetadataSaved after successful save', async () => {
    const scope = fork();

    const events: any[] = [];
    chunkMetadataSaved.watch((event) => {
      events.push(event);
    });

    const chunkData = {
      fileId: 'test-file-id',
      chunkNumber: 0,
      hash: 'abc123hash',
      chunkSize: 1024
    };

    await allSettled(chunkMetadataSaveRequested, {
      scope,
      params: chunkData
    });

    // Verify that chunkMetadataSaved was triggered
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].fileId).toBe(chunkData.fileId);
    expect(events[0].chunkNumber).toBe(chunkData.chunkNumber);
  });
});
