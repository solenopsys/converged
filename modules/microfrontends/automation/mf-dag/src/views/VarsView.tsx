import React, { useEffect } from 'preact/compat';
import { useUnit } from 'effector-preact';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from "front-core";
import { $vars, $varsLoading, openVarForm, refreshVarsClicked, showVars } from '../domain-vars';
import { varsColumns } from '../functions/columns';
import { createVarFormWidget } from '../functions/vars';

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

  const handleRowClick = (row: { key: string; value: any }) => {
    openVarForm({ variable: row });
    bus.present({
      widget: createVarFormWidget(bus),
      params: { entity: row },
      tab: { key: `dag.var:${row.key}`, title: row.key },
    });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={vars}
        hasMore={false}
        loading={loading}
        columns={varsColumns}
        onLoadMore={() => {}}
        onRowClick={handleRowClick}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
