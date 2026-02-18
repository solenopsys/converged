import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanel, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw, Plus } from 'lucide-react';
import { $providersStore, providersViewMounted, refreshProvidersClicked, addProviderClicked, openProviderForm } from '../domain-providers';
import { providersColumns } from '../functions/columns';
import { createProviderFormWidget } from '../functions/provider.config';

export const ProvidersListView = ({ bus }) => {
  const providersState = useUnit($providersStore.$state);

  useEffect(() => {
    providersViewMounted();

    const unwatch = addProviderClicked.watch(() => {
      openProviderForm({ provider: null });
      bus.present({ widget: createProviderFormWidget(bus) });
    });

    return () => unwatch();
  }, [bus]);

  const headerConfig = {
    title: 'Providers',
    actions: [
      {
        id: 'add',
        label: 'Add Provider',
        icon: Plus,
        event: addProviderClicked,
        variant: 'default' as const,
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshProvidersClicked,
        variant: 'outline' as const,
      },
    ],
  };

  const handleRowClick = (row) => {
    openProviderForm({ provider: row });
    bus.present({ widget: createProviderFormWidget(bus) });
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={providersState.items}
          hasMore={providersState.hasMore}
          loading={providersState.loading}
          columns={providersColumns}
          onLoadMore={$providersStore.loadMore}
          onRowClick={handleRowClick}
          viewMode="table"
        />
      </div>
    </div>
  );
};

export default ProvidersListView;
