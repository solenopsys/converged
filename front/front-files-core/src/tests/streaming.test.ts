import { allSettled, fork } from 'effector';
import {
  compressionStarted,
  $compressionState,
  chunkPrepared,
  compressionCompleted,
  decompressionStarted,
  decompressionStateInitialized,
  decompressionFailed,
  $decompressionState,
  readFileChunkFx,
  compressDataFx
} from '../segments/streaming';
import { $fileMetadataCache } from '../segments/files';
import { FileMetadata } from '../../../types/files';

describe('streaming module', () => {
  test('should run compression process', async () => {
    const scope = fork({
      handlers: [
        [readFileChunkFx, () => ({ data: new Uint8Array([1, 2, 3]), done: true })],
        [compressDataFx, ({ data, final }) => ({ 
          compressed: new Uint8Array([...data, 4]), 
          final 
        })]
      ]
    });
    
    const file = new File(['test content'], 'test.txt');
    const fileId = 'test-uuid' as any;

    const chunkPreparedWatcher = jest.fn();
    const compressionCompletedWatcher = jest.fn();
    
    chunkPrepared.watch(chunkPreparedWatcher);
    compressionCompleted.watch(compressionCompletedWatcher);

    await allSettled(compressionStarted, {
      scope,
      params: {
        fileId,
        file
      }
    });

    const state = scope.getState($compressionState);
    expect(state.has(fileId)).toBe(true);
    
    // Проверяем, что компрессия выполнилась
    expect(compressionCompletedWatcher).toHaveBeenCalled();
  });

  test('should initialize decompression state from metadata', async () => {
    const fileId = 'test-uuid' as any;
    const metadata: FileMetadata = {
      id: fileId,
      hash: 'file-hash' as any,
      status: 'completed',
      name: 'test.txt',
      fileSize: 2048,
      fileType: 'text/plain',
      compression: 'deflate',
      owner: 'test-owner',
      createdAt: new Date().toISOString(),
      chunksCount: 2
    };

    const scope = fork({
      values: [
        [$fileMetadataCache, new Map([[fileId, metadata]])]
      ]
    });

    await allSettled(decompressionStarted, {
      scope,
      params: { fileId }
    });

    const state = scope.getState($decompressionState);
    expect(state.has(fileId)).toBe(true);
    expect(state.get(fileId)?.totalChunks).toBe(2);
    expect(state.get(fileId)?.currentChunkNumber).toBe(0);
  });

  test('should handle chunk preparation', async () => {
    const scope = fork();
    
    const fileId = 'test-uuid' as any;
    const chunkData = new Uint8Array([1, 2, 3, 4, 5]);
    const chunkNumber = 0;

    const chunkPreparedWatcher = jest.fn();
    chunkPrepared.watch(chunkPreparedWatcher);

    await allSettled(chunkPrepared, {
      scope,
      params: {
        fileId,
        chunkNumber,
        data: chunkData
      }
    });

    expect(chunkPreparedWatcher).toHaveBeenCalledWith({
      fileId,
      chunkNumber,
      data: chunkData
    });
  });

  test('should fail gracefully if metadata not found', async () => {
    const fileId = 'non-existent-uuid' as any;
    const scope = fork({
      values: [
        [$fileMetadataCache, new Map()]
      ]
    });

    const decompressionFailedWatcher = jest.fn();
    const decompressionStateInitializedWatcher = jest.fn();
    
    decompressionFailed.watch(decompressionFailedWatcher);
    decompressionStateInitialized.watch(decompressionStateInitializedWatcher);

    await allSettled(decompressionStarted, {
      scope,
      params: { fileId }
    });

    // Проверяем, что было вызвано событие ошибки
    expect(decompressionFailedWatcher).toHaveBeenCalledWith({
      fileId,
      error: `File metadata not found for ${fileId}`
    });
    
    // Проверяем, что инициализация НЕ была вызвана
    expect(decompressionStateInitializedWatcher).not.toHaveBeenCalled();
    
    // Проверяем, что состояние не изменилось
    const state = scope.getState($decompressionState);
    expect(state.has(fileId)).toBe(false);
  });
});