import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import {
  $telemetryHotStore,
  $telemetryColdStore,
  refreshTelemetryClicked,
  telemetryViewMounted,
  type TelemetryMode,
} from "../domain-telemetry";
import { telemetryColumns } from "../functions/columns";

export const TelemetryView = ({ mode = "hot" }: { mode?: TelemetryMode }) => {
  const $store = mode === "hot" ? $telemetryHotStore : $telemetryColdStore;
  const telemetryState = useUnit($store.$state);

  useEffect(() => {
    telemetryViewMounted(mode);
  }, [mode]);

  const headerConfig = {
    title: mode === "hot" ? "Telemetry (Hot)" : "Telemetry (Cold)",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshTelemetryClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={telemetryState.items}
          hasMore={telemetryState.hasMore}
          loading={telemetryState.loading}
          columns={telemetryColumns}
          onLoadMore={$store.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};
