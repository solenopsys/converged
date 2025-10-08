import { fileTransferDomain } from "../domain";
import { type UUID, HashString } from "../../../../types/files";
import { sample } from "effector";
import { services } from "../services";

// Events
export const blockSaveRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>();

export const blockSaved = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  hash: HashString;
}>();

export const blockLoadRequested = fileTransferDomain.createEvent<{
  fileId: UUID;
  hash: HashString;
  chunkNumber: number;
}>();

export const blockLoaded = fileTransferDomain.createEvent<{
  fileId: UUID;
  chunkNumber: number;
  data: Uint8Array;
}>();

// Effects
export const saveBlockFx = fileTransferDomain.createEffect<
  Uint8Array,
  HashString
>(async (data) => services.storeService.save(data));

export const loadBlockFx = fileTransferDomain.createEffect<
  HashString,
  Uint8Array
>(async (hash) => services.storeService.get(hash));

// Stores
export const $blockCache = fileTransferDomain.createStore<Map<HashString, Uint8Array>>(new Map());

// Logic
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