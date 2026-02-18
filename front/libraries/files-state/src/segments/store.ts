import { fileTransferDomain } from "../domain";
import { type UUID, type HashString } from "../../../../../types/files";
import { sample } from "effector";
import { services } from "../services";

const decodeBase64ToUint8Array = (value: string): Uint8Array => {
  const base64Pattern =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  if (!base64Pattern.test(value)) {
    throw new Error("StoreService.get returned non-base64 string");
  }

  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  throw new Error("Base64 decoding is not available");
};

const normalizeBlockData = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer);
  }

  if (typeof value === "string") {
    return decodeBase64ToUint8Array(value);
  }

  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.__type === "Uint8Array") {
      return normalizeBlockData(record.data);
    }
    if ("data" in record) {
      return normalizeBlockData(record.data);
    }
  }

  throw new Error("StoreService.get returned invalid data");
};

// Events
export const blockSaveRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
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

// Effects
export const saveBlockFx = fileTransferDomain.createEffect<
  { fileId: UUID; chunkNumber: number; data: Uint8Array; originalSize: number; compression: 'none' | 'deflate' },
  HashString
>('SAVE_BLOCK_FX');
saveBlockFx.use(async ({ fileId, chunkNumber, data, originalSize, compression }) => {
  console.log(`[saveBlockFx] Starting save for chunk ${chunkNumber}, size=${data.length}, originalSize=${originalSize}, compression=${compression}`);
  try {
    const result = await services.storeService.save(data, originalSize, compression);
    console.log(`[saveBlockFx] Success for chunk ${chunkNumber}, hash=${result}`);
    return result;
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
  const payload = await services.storeService.get(hash);
  return normalizeBlockData(payload);
});

// Stores
export const $blockCache = fileTransferDomain.createStore<Map<HashString, Uint8Array>>(new Map(), { name: 'BLOCK_CACHE' });

// Logic - Save
// Forward the full request into the effect so params are preserved per call
sample({
  clock: blockSaveRequested,
  fn: ({ fileId, chunkNumber, data, originalSize, compression }) => ({ fileId, chunkNumber, data, originalSize, compression }),
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
