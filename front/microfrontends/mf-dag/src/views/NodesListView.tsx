import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw, Plus } from 'lucide-react';
import { $nodesStore, nodesViewMounted, refreshNodesClicked, addNodeClicked, openNodeForm } from '../domain-nodes';
import { nodesColumns } from '../functions/columns';
import { createNodeFormWidget } from '../functions/node.config';

export const NodesListView = ({ bus }) => {
  const nodesState = useUnit($nodesStore.$state);

  useEffect(() => {
    nodesViewMounted();

    const unwatch = addNodeClicked.watch(() => {
      openNodeForm({ node: null });
      bus.present({ widget: createNodeFormWidget(bus) });
    });

    return () => unwatch();
  }, [bus]);

  const headerConfig = {
    title: 'Nodes',
    actions: [
      {
        id: 'add',
        label: 'Add Node',
        icon: Plus,
        event: addNodeClicked,
        variant: 'default' as const,
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshNodesClicked,
        variant: 'outline' as const,
      },
    ],
  };

  const handleRowClick = (row) => {
    openNodeForm({ node: row });
    bus.present({ widget: createNodeFormWidget(bus) });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={nodesState.items}
          hasMore={nodesState.hasMore}
          loading={nodesState.loading}
          columns={nodesColumns}
          onLoadMore={$nodesStore.loadMore}
          onRowClick={handleRowClick}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};

export default NodesListView;
