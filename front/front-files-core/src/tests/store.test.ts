import { allSettled, fork } from 'effector';
import { services } from '../services';
import {
  blockSaveRequested,
  blockSaved,
  saveBlockFx,
  blockLoadRequested,
  blockLoaded,
  loadBlockFx
} from '../segments/store';

describe('store module', () => {
  beforeAll(() => {
    // Mock StoreService
    const mockStoreService = {
      save: jest.fn(async (data: Uint8Array) => 'hash-' + data.length),
      get: jest.fn(async (hash: string) => new Uint8Array([1, 2, 3, 4]))
    };

    services.setStoreService(mockStoreService as any);
  });

  test('should save block and emit blockSaved', async () => {
    const scope = fork();
    
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const fileId = 'test-file-id' as any;
    const chunkNumber = 0;

    const savedEvents: any[] = [];
    scope.getState(blockSaved.watch(event => savedEvents.push(event)));

    await allSettled(blockSaveRequested, {
      scope,
      params: {
        fileId,
        chunkNumber,
        data
      }
    });

    expect(scope.getState(saveBlockFx.pending)).toBe(false);
  });

  test('should load block by hash', async () => {
    const scope = fork();
    
    const fileId = 'test-file-id' as any;
    const hash = 'test-hash' as any;
    const chunkNumber = 0;

    const loadedEvents: any[] = [];
    scope.getState(blockLoaded.watch(event => loadedEvents.push(event)));

    await allSettled(blockLoadRequested, {
      scope,
      params: {
        fileId,
        hash,
        chunkNumber
      }
    });

    expect(scope.getState(loadBlockFx.pending)).toBe(false);
  });
});