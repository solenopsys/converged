import { createStore, createEvent, createEffect, sample } from "effector";
import { mailingClient, type Mail } from "../generated";

const PAGE_SIZE = 30;
const TOTAL_COUNT = 250000;

// Shared mutable array for VirtualTable
export const mailsData: Mail[] = [];

// Events
export const loadMore = createEvent();
export const tableReady = createEvent<{ updateData: () => void }>();

// Effects
export const loadMailsFx = createEffect(async (offset: number) => {
  const result = await mailingClient.listWarmMails({
    offset,
    limit: PAGE_SIZE,
  });

  // Push directly to shared array
  const items = result.items || [];
  mailsData.push(...items);
  console.log(`Loaded ${mailsData.length} mails`);

  return items.length;
});

// Stores - only metadata
export const $offset = createStore(0);
export const $isLoading = createStore(false);
export const $tableApi = createStore<{ updateData: () => void } | null>(null);

// Logic
$offset.on(loadMailsFx.doneData, (state, count) => state + count);

$isLoading.on(loadMailsFx.pending, (_, pending) => pending);

$tableApi.on(tableReady, (_, api) => api);

// Update table when it's ready (if data already loaded)
tableReady.watch((api) => {
  if (mailsData.length > 0) {
    api.updateData();
  }
});

// Update table when data loaded
loadMailsFx.done.watch(() => {
  const api = $tableApi.getState();
  if (api) {
    api.updateData();
  }
});

// Load more logic
sample({
  clock: loadMore,
  source: { offset: $offset, isLoading: $isLoading },
  filter: ({ offset, isLoading }) => !isLoading && offset < TOTAL_COUNT,
  fn: ({ offset }) => offset,
  target: loadMailsFx,
});

// Initial load on app start
loadMailsFx(0);
