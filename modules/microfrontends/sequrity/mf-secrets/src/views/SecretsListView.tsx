import { useEffect } from "preact/compat";
import { useUnit } from "effector-preact";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "front-core";
import {
  $secretsStore,
  secretsViewMounted,
  refreshSecretsClicked,
  openSecretDetail,
  getSecretFx,
} from "../domain-secrets";
import { secretsColumns } from "../functions/columns";
import { createSecretDetailWidget } from "../functions/secrets";

export const SecretsListView = ({ bus }) => {
  const secretsState = useUnit($secretsStore.$state);

  useEffect(() => {
    secretsViewMounted();
  }, []);

  const headerConfig = {
    title: "Secrets",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshSecretsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const handleRowClick = (row: { name: string }) => {
    openSecretDetail({ name: row.name });
    getSecretFx(row.name);
    bus.present({
      widget: createSecretDetailWidget(bus),
      params: { entity: row },
      tab: { key: `secrets:${row.name}`, title: row.name },
    });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={secretsState.items}
        hasMore={secretsState.hasMore}
        loading={secretsState.loading}
        columns={secretsColumns}
        onRowClick={handleRowClick}
        onLoadMore={$secretsStore.loadMore}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
