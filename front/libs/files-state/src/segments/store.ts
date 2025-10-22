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
  { fileId: UUID; chunkNumber: number; data: Uint8Array },
  HashString
>('SAVE_BLOCK_FX');
saveBlockFx.use(async ({ data }) => services.storeService.save(data));

export const loadBlockFx = fileTransferDomain.createEffect<
  { fileId: UUID; hash: HashString; chunkNumber: number },
  Uint8Array
>('LOAD_BLOCK_FX');
loadBlockFx.use(async ({ hash }) => services.storeService.get(hash));

// Stores
export const $blockCache = fileTransferDomain.createStore<Map<HashString, Uint8Array>>(new Map(), { name: 'BLOCK_CACHE' });

// Logic - Save
// Forward the full request into the effect so params are preserved per call
sample({
  clock: blockSaveRequested,
  fn: ({ fileId, chunkNumber, data }) => ({ fileId, chunkNumber, data }),
  target: saveBlockFx
});

// Use effect.done to pair result with the exact params of that invocation
sample({
  clock: saveBlockFx.done,
  fn: ({ params, result }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    hash: result
  }),
  target: blockSaved
});

sample({
  clock: saveBlockFx.fail,
  fn: ({ params, error }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    error
  }),
  target: blockSaveFailed
});

// Logic - Load
// Передаем полный объект в effect чтобы сохранить все параметры
sample({
  clock: blockLoadRequested,
  fn: (request) => request,
  target: loadBlockFx
});

sample({
  clock: loadBlockFx.done,
  fn: ({ params, result }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    data: result
  }),
  target: blockLoaded
});

sample({
  clock: loadBlockFx.fail,
  fn: ({ params, error }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
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