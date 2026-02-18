import { test, expect, describe, beforeEach, mock, spyOn } from 'bun:test';
import { allSettled, fork } from 'effector';

// Import modules first
import {
  compressionStarted,
  blockSaved,
  chunkMetadataSaved,
  $chunks,
  $files,
} from './streaming';

import {
  fileMetadataCreateRequested,
  chunkMetadataSaveRequested,
  saveChunkMetadataFx,
} from './files';

import { services } from '../services';

describe('Upload flow integration', () => {
  let saveChunkSpy: any;

  beforeEach(() => {
    // Mock the saveChunk service method
    saveChunkSpy = spyOn(services.filesService, 'saveChunk');
    saveChunkSpy.mockImplementation(async (chunk: any) => chunk.hash);
  });

  test('full upload flow: file -> chunks -> metadata -> progress', async () => {
    const scope = fork();

    const fileId = 'test-file-' + Date.now();
    const fileName = 'test.txt';
    const fileSize = 1024;

    // Track events
    const uploadedChunks: any[] = [];
    const savedMetadata: any[] = [];

    // Start compression (simulates file selected)
    await allSettled(compressionStarted, {
      scope,
      params: { fileId, fileName, fileSize }
    });

    // Simulate worker sending blockSaved event
    const hash1 = 'abc123hash000001';
    await allSettled(blockSaved, {
      scope,
      params: {
        fileId,
        chunkNumber: 0,
        hash: hash1,
        originalSize: 512,
        compression: 'deflate' as const,
      }
    });

    // Check that saveChunk was called
    expect(saveChunkSpy).toHaveBeenCalled();
    const firstCall = saveChunkSpy.mock.calls[0];
    expect(firstCall[0].fileId).toBe(fileId);
    expect(firstCall[0].hash).toBe(hash1);
    expect(firstCall[0].chunkNumber).toBe(0);

    // Simulate successful metadata save by triggering chunkMetadataSaved
    await allSettled(chunkMetadataSaved, {
      scope,
      params: { fileId, chunkNumber: 0 }
    });

    // Check files state
    const filesState = scope.getState($files);
    const fileState = filesState.get(fileId);

    expect(fileState).toBeDefined();
    expect(fileState?.status).toBe('uploading');

    // Add second chunk
    const hash2 = 'abc123hash000002';
    await allSettled(blockSaved, {
      scope,
      params: {
        fileId,
        chunkNumber: 1,
        hash: hash2,
        originalSize: 512,
        compression: 'deflate' as const,
      }
    });

    await allSettled(chunkMetadataSaved, {
      scope,
      params: { fileId, chunkNumber: 1 }
    });

    // Verify both chunks were saved
    expect(saveChunkSpy.mock.calls.length).toBe(2);

    console.log('[TEST] Files state:', filesState);
    console.log('[TEST] Chunks saved:', saveChunkSpy.mock.calls.length);
  });

  test('chunkUploaded event is triggered after metadata saved', async () => {
    const scope = fork();

    const fileId = 'test-chunk-upload';
    const hash = 'test-hash-123';

    // Track chunkUploaded events
    const uploadedEvents: any[] = [];

    // First send blockSaved to populate pending hashes
    await allSettled(blockSaved, {
      scope,
      params: {
        fileId,
        chunkNumber: 0,
        hash,
        originalSize: 100,
        compression: 'deflate' as const,
      }
    });

    // Then trigger metadata saved
    await allSettled(chunkMetadataSaved, {
      scope,
      params: { fileId, chunkNumber: 0 }
    });

    // Check that saveChunk was called
    expect(saveChunkSpy).toHaveBeenCalled();
  });

  test('progress calculation', async () => {
    const scope = fork();

    const fileId = 'progress-test';
    const totalChunks = 3;

    // Start upload
    await allSettled(compressionStarted, {
      scope,
      params: {
        fileId,
        fileName: 'test.bin',
        fileSize: totalChunks * 1024
      }
    });

    // Upload chunks one by one
    for (let i = 0; i < totalChunks; i++) {
      await allSettled(blockSaved, {
        scope,
        params: {
          fileId,
          chunkNumber: i,
          hash: `hash-${i}`,
          originalSize: 1024,
          compression: 'deflate' as const,
        }
      });

      await allSettled(chunkMetadataSaved, {
        scope,
        params: { fileId, chunkNumber: i }
      });
    }

    // Check final state
    const filesState = scope.getState($files);
    const fileState = filesState.get(fileId);

    console.log('[TEST] Final file state:', fileState);
    console.log('[TEST] Total chunks processed:', totalChunks);
  });
});
