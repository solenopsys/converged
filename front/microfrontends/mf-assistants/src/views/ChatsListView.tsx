import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanel, InfiniteScrollDataTable } from 'front-core';
import { Plus, RefreshCw } from 'lucide-react';
import { $chatsStore, chatsListViewMounted, refreshChatsClicked, addChatClicked, openChatDetail } from '../domain-chats';
import { chatsColumns } from '../config';
import { createChatDetailWidget } from '../functions';

export const ChatsListView = ({ bus }) => {
  const chatsState = useUnit($chatsStore.$state);

  useEffect(() => {
    chatsListViewMounted();
  }, []);

  const headerConfig = {
    title: 'Chats List',
    actions: [
      {
        id: 'add',
        label: 'New Chat',
        icon: Plus,
        event: addChatClicked,
        variant: 'default' as const
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshChatsClicked,
        variant: 'outline' as const
      }
    ]
  };

  const handleRowClick = (row) => {
    const recordId = row.id;
    openChatDetail({ recordId });
    bus.present({ widget: createChatDetailWidget(bus, { recordId }), params: { recordId } });
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />

      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={chatsState.items}
          hasMore={chatsState.hasMore}
          loading={chatsState.loading}
          columns={chatsColumns}
          onRowClick={handleRowClick}
          onLoadMore={$chatsStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};
