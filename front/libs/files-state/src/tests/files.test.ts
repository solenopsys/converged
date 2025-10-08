import { allSettled, fork } from 'effector';
import { services } from '../services';
import {
  fileMetadataCreateRequested,
  fileMetadataCreated,
  saveFileMetadataFx,
  $fileMetadataCache,
  fileMetadataLoaded
} from '../segments/files';

describe('files module', () => {
  beforeAll(() => {
    // Mock FilesService
    const mockFilesService = {
      save: jest.fn(async (file) => file.id),
      saveChunk: jest.fn(async (chunk) => chunk.hash),
      get: jest.fn(async (id) => ({
        id,
        name: 'test.txt',
        fileSize: 1024,
        fileType: 'text/plain',
        hash: 'hash123',
        status: 'uploading',
        compression: 'deflate',
        owner: 'user-1',
        createdAt: new Date().toISOString(),
        chunksCount: 10
      })),
      getChunks: jest.fn(async () => [])
    };

    services.setFilesService(mockFilesService as any);
  });

  test('should create file metadata', async () => {
    const scope = fork();
    
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const fileId = 'test-uuid' as any;

    await allSettled(fileMetadataCreateRequested, {
      scope,
      params: {
        fileId,
        file,
        owner: 'user-1'
      }
    });

    expect(scope.getState(saveFileMetadataFx.pending)).toBe(false);
  });

  test('should cache loaded metadata', async () => {
    const scope = fork();
    
    const metadata = {
      id: 'test-uuid' as any,
      name: 'test.txt',
      fileSize: 1024,
      fileType: 'text/plain',
      hash: 'hash123',
      status: 'uploading' as const,
      compression: 'deflate',
      owner: 'user-1',
      createdAt: new Date().toISOString(),
      chunksCount: 10
    };

    await allSettled(fileMetadataLoaded, {
      scope,
      params: metadata
    });

    const cache = scope.getState($fileMetadataCache);
    expect(cache.get(metadata.id)).toEqual(metadata);
  });
});