import { createDomain, sample } from 'effector';
import { createInfiniteTableStore } from 'front-core';
import { assistantClient as chatsService } from './services';
import { PaginationParams } from './types';

const domain = createDomain('assistants-list');

// Events
export const chatsListViewMounted = domain.createEvent('CHATS_LIST_VIEW_MOUNTED');
export const refreshChatsClicked = domain.createEvent('REFRESH_CHATS_CLICKED');
export const addChatClicked = domain.createEvent('ADD_CHAT_CLICKED');
export const openChatDetail = domain.createEvent<{ recordId: string }>('OPEN_CHAT_DETAIL');

// Effects
const listChatsFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_CHATS',
  handler: async (params: PaginationParams) => {
    return await chatsService.listOfChats(params);
  }
});

// Store
export const $chatsStore = createInfiniteTableStore(domain, listChatsFx);

// Load data when view mounts
sample({
  clock: chatsListViewMounted,
  filter: () => {
    const state = $chatsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $chatsStore.loadMore
});

// Refresh action
sample({
  clock: refreshChatsClicked,
  fn: () => ({}),
  target: $chatsStore.reset
});

sample({
  clock: refreshChatsClicked,
  fn: () => ({}),
  target: $chatsStore.loadMore
});

export default domain;
