import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from 'lucide-react';
import { $vars, $varsLoading, refreshVarsClicked, showVars } from '../domain-vars';
import { varsColumns } from '../functions/columns';

export const VarsView = ({ bus }: { bus: any }) => {
  const vars = useUnit($vars);
  const loading = useUnit($varsLoading);

  useEffect(() => {
    showVars();
  }, []);

  const headerConfig = {
    title: 'Vars',
    actions: [
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshVarsClicked,
        variant: 'outline' as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={vars}
        hasMore={false}
        loading={loading}
        columns={varsColumns}
        onLoadMore={() => {}}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
