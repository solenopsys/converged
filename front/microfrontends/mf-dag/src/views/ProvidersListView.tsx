import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
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
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={providersState.items}
          hasMore={providersState.hasMore}
          loading={providersState.loading}
          columns={providersColumns}
          onLoadMore={$providersStore.loadMore}
          onRowClick={handleRowClick}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};

export default ProvidersListView;
