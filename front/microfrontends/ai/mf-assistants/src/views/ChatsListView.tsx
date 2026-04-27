import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanelLayout, InfiniteScrollDataTable, useMicrofrontendTranslation } from 'front-core';
import { Plus, RefreshCw } from 'lucide-react';
import { $chatsStore, chatsListViewMounted, refreshChatsClicked, addChatClicked } from '../domain-chats';
import { createChatsColumns } from '../config';

export const ChatsListView = ({ bus }) => {
  const chatsState = useUnit($chatsStore.$state);
  const { t } = useMicrofrontendTranslation('assistants-mf');

  useEffect(() => {
    chatsListViewMounted();
  }, []);

  const headerConfig = {
    title: t('chatsList.title'),
    actions: [
      {
        id: 'add',
        label: t('chatsList.actions.newChat'),
        icon: Plus,
        event: addChatClicked,
        variant: 'default' as const
      },
      {
        id: 'refresh',
        label: t('chatsList.actions.refresh'),
        icon: RefreshCw,
        event: refreshChatsClicked,
        variant: 'outline' as const
      }
    ]
  };

  const handleRowClick = (row) => {
    const recordId = row.threadId || row.id || row.chatId;
    if (!recordId) return;
    bus.run('chats.view', { recordId });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={chatsState.items}
          hasMore={chatsState.hasMore}
          loading={chatsState.loading}
          columns={createChatsColumns(t)}
          onRowClick={handleRowClick}
          onLoadMore={$chatsStore.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};
