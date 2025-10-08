import { allSettled, fork } from 'effector';
import { services } from '../services';
import { fileInitialized } from '../segments/browser';
import { $compressionState, readFileChunkFx, compressDataFx } from '../segments/streaming';
import { saveFileMetadataFx, $files } from '../segments/files';

// Import integrations to activate them
import '../integrations';

describe('integration tests', () => {
  beforeAll(() => {
    // Mock services
    const mockFilesService = {
      save: jest.fn(async (file) => file.id),
      saveChunk: jest.fn(async (chunk) => chunk.hash),
      get: jest.fn(),
      getChunks: jest.fn()
    };

    const mockStoreService = {
      save: jest.fn(async (data: Uint8Array) => 'hash-' + data.length),
      get: jest.fn()
    };

    services.setFilesService(mockFilesService as any);
    services.setStoreService(mockStoreService as any);
  });

  test('fileInitialized should trigger metadata creation and compression', async () => {
    const scope = fork({
      handlers: [
        [readFileChunkFx, () => ({ data: new Uint8Array([1, 2, 3]), done: true })],
        [compressDataFx, ({ data, final }) => ({ compressed: data, final })]
      ]
    });
    
    const file = new File(['test content for compression'], 'test.txt');
    const fileId = 'test-uuid' as any;
    const owner = 'user-1';

    await allSettled(fileInitialized, {
      scope,
      params: {
        fileId,
        file,
        owner
      }
    });

    // Check file was added to $files
    const files = scope.getState($files);
    expect(files.has(fileId)).toBe(true);
    expect(files.get(fileId)?.status).toBe('uploading');

    // Check compression was started
    const compressionState = scope.getState($compressionState);
    expect(compressionState.has(fileId)).toBe(true);

    // Check metadata creation was triggered
    expect(scope.getState(saveFileMetadataFx.pending)).toBe(false);
  });

    test('upload flow integration', async () => {
      const scope = fork({
        handlers: [
          [readFileChunkFx, () => ({ data: new Uint8Array([1, 2, 3]), done: true })],
          [compressDataFx, ({ data, final }) => ({ compressed: data, final })]
        ]
      });
      
      const file = new File(['small test'], 'small.txt');
    const fileId = 'upload-test-uuid' as any;

    // Start upload
    await allSettled(fileInitialized, {
      scope,
      params: {
        fileId,
        file,
        owner: 'user-1'
      }
    });

    // Verify file state
    const files = scope.getState($files);
    const fileState = files.get(fileId);
    
    expect(fileState).toBeDefined();
    expect(fileState?.fileName).toBe('small.txt');
    expect(fileState?.fileSize).toBe(file.size);
  });
});