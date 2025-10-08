import { fileTransferDomain } from "../domain";
import { type UUID, HashString } from "../../../../types/files";

import { sample } from "effector";
import { StoreService } from "../../../../types/store";

export const $storeService = fileTransferDomain.createStore<StoreService | null>(null);


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

// Effects - атомарные операции
export const saveBlockFx = fileTransferDomain.createEffect<
  { storeService: StoreService; data: Uint8Array },
  HashString
>(async ({ storeService, data }) => storeService.save(data));

export const loadBlockFx = fileTransferDomain.createEffect<
  { storeService: StoreService; hash: HashString },
  Uint8Array
>(async ({ storeService, hash }) => storeService.get(hash));

// Stores
export const $blockCache = fileTransferDomain.createStore<Map<HashString, Uint8Array>>(new Map());

// Logic
sample({
  clock: blockSaveRequested,
  source: $storeService,
  filter: (service) => service !== null,
  fn: (service, { data }) => ({ storeService: service!, data }),
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
  source: $storeService,
  filter: (service) => service !== null,
  fn: (service, { hash }) => ({ storeService: service!, hash }),
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