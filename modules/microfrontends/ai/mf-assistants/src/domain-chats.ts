import { createDomain, sample } from 'effector';
import { createInfiniteTableStore } from 'front-core';
import { assistantClient as chatsService } from './services';
import { PaginationParams } from './types';

const domain = createDomain('assistants-list');

export const chatsListViewMounted = domain.createEvent('CHATS_LIST_VIEW_MOUNTED');
export const refreshChatsClicked = domain.createEvent('REFRESH_CHATS_CLICKED');
export const addChatClicked = domain.createEvent('ADD_CHAT_CLICKED');

const listChatsFx = domain.createEffect<PaginationParams, any>({
  name: 'LIST_CHATS',
  handler: async (params: PaginationParams) => {
    return await chatsService.listOfChats(params);
  }
});

export const $chatsStore = createInfiniteTableStore(domain, listChatsFx);

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
