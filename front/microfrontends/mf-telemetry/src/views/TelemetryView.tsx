import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import type { TelemetryMode } from "../domain-telemetry";
import {
  $telemetryStore,
  refreshTelemetryClicked,
  telemetryViewMounted,
} from "../domain-telemetry";
import { telemetryColumns } from "../functions/columns";

interface TelemetryViewProps {
  mode?: TelemetryMode;
}

export const TelemetryView = ({ mode = "hot" }: TelemetryViewProps) => {
  const telemetryState = useUnit($telemetryStore.$state);

  useEffect(() => {
    telemetryViewMounted({ mode });
  }, [mode]);

  const headerConfig = {
    title: "Telemetry",
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
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={telemetryState.items}
          hasMore={telemetryState.hasMore}
          loading={telemetryState.loading}
          columns={telemetryColumns}
          onLoadMore={$telemetryStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};
