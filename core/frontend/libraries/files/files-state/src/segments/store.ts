import { fileTransferDomain } from "../domain";
import { type UUID, type HashString } from "../../../../../types/files";
import { sample } from "effector";
import { services } from "../services";

export const blockSaveRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  dataRef: { cacheKey: string; sizeBytes?: number };
  originalSize: number;
  compression: 'none' | 'deflate';
}>('BLOCK_SAVE_REQUESTED');

export const blockSaved = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  hash: HashString;
  chunkSize: number;
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

export const saveBlockFx = fileTransferDomain.createEffect<
  { fileId: UUID; chunkNumber: number; dataRef: { cacheKey: string; sizeBytes?: number }; originalSize: number; compression: 'none' | 'deflate' },
  { hash: HashString; chunkSize: number }
>('SAVE_BLOCK_FX');
saveBlockFx.use(async ({ chunkNumber, dataRef, originalSize, compression }) => {
  try {
    const hash = await services.storeService.save(dataRef, originalSize, compression);
    return { hash, chunkSize: dataRef.sizeBytes ?? 0 };
  } catch (error) {
    console.error(`[saveBlockFx] Failed for chunk ${chunkNumber}:`, error);
    throw error;
  }
});

export const loadBlockFx = fileTransferDomain.createEffect<
  { fileId: UUID; hash: HashString; chunkNumber: number },
  Uint8Array
>('LOAD_BLOCK_FX');
loadBlockFx.use(async ({ hash }) => {
  const ref = await services.storeService.get(hash);
  const response = await fetch(`/cache/blob/${encodeURIComponent(ref.cacheKey)}`);
  if (!response.ok) throw new Error(`Cache blob download failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
});

export const $blockCache = fileTransferDomain.createStore<Map<HashString, Uint8Array>>(new Map(), { name: 'BLOCK_CACHE' });

// Forward the full request into the effect so params are preserved per call
sample({
  clock: blockSaveRequested,
  fn: ({ fileId, chunkNumber, dataRef, originalSize, compression }) => ({ fileId, chunkNumber, dataRef, originalSize, compression }),
  target: saveBlockFx
});

// Use effect.done to pair result with the exact params of that invocation
sample({
  clock: saveBlockFx.done,
  fn: ({ params, result }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    hash: result.hash,
    chunkSize: result.chunkSize,
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
  const hash = `cache-${chunkNumber}` as HashString;
  newMap.set(hash, data);
  return newMap;
});
