import { fileTransferDomain } from "../domain";
import { type UUID, HashString } from "../../../../../types/files";
import { sample } from "effector";
import { services } from "../services";

// Events
export const blockSaveRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>('BLOCK_SAVE_REQUESTED');

export const blockSaved = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  hash: HashString;
}>('BLOCK_SAVED');

export const blockSaveFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  error: Error;
}>('BLOCK_SAVE_FAILED');

export const blockLoadRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  hash: HashString;
  chunkNumber: number;
}>('BLOCK_LOAD_REQUESTED');

export const blockLoaded = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>('BLOCK_LOADED');

export const blockLoadFailed = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  error: Error;
}>('BLOCK_LOAD_FAILED');

// Effects
export const saveBlockFx = fileTransferDomain.createEffect<
  Uint8Array,
  HashString
>('SAVE_BLOCK_FX');
saveBlockFx.use(async (data) => services.storeService.save(data));

export const loadBlockFx = fileTransferDomain.createEffect<
  HashString,
  Uint8Array
>('LOAD_BLOCK_FX');
loadBlockFx.use(async (hash) => services.storeService.get(hash));

// Stores
export const $blockCache = fileTransferDomain.createStore<Map<HashString, Uint8Array>>(new Map(), { name: 'BLOCK_CACHE' });

// Logic - Save
sample({
  clock: blockSaveRequested,
  fn: ({ data }) => data,
  target: saveBlockFx
});

sample({
  clock: saveBlockFx.doneData,
  source: blockSaveRequested,
  fn: (request, hash) => ({
    fileId: request.fileId,
    chunkNumber: request.chunkNumber,
    hash
  }),
  target: blockSaved
});

sample({
  clock: saveBlockFx.fail,
  source: blockSaveRequested,
  fn: (request, { error }) => ({
    fileId: request.fileId,
    chunkNumber: request.chunkNumber,
    error
  }),
  target: blockSaveFailed
});

// Logic - Load
sample({
  clock: blockLoadRequested,
  fn: ({ hash }) => hash,
  target: loadBlockFx
});

sample({
  clock: loadBlockFx.doneData,
  source: blockLoadRequested,
  fn: (request, data) => ({
    fileId: request.fileId,
    chunkNumber: request.chunkNumber,
    data
  }),
  target: blockLoaded
});

sample({
  clock: loadBlockFx.fail,
  source: blockLoadRequested,
  fn: (request, { error }) => ({
    fileId: request.fileId,
    chunkNumber: request.chunkNumber,
    error
  }),
  target: blockLoadFailed
});

// Cache management
$blockCache.on(blockLoaded, (state, { chunkNumber, data }) => {
  const newMap = new Map(state);
  // Используем chunkNumber как часть ключа для кеша
  const hash = `cache-${chunkNumber}` as HashString;
  newMap.set(hash, data);
  return newMap;
});