import React, { useEffect, useMemo } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { PhoneCall, RefreshCw } from "lucide-react";
import {
  $sessions,
  $sessionsLoading,
  sessionsListMounted,
  refreshSessionsClicked,
  startNewCallClicked,
} from "../domain-calls";
import { callsColumns, type CallRow } from "../config";

type CallsListViewProps = {
  bus?: any;
};

export const CallsListView: React.FC<CallsListViewProps> = ({ bus }) => {
  const sessions = useUnit($sessions);
  const loading = useUnit($sessionsLoading);

  useEffect(() => {
    sessionsListMounted();
  }, []);

  const rows = useMemo<CallRow[]>(() => sessions.map((id) => ({ id })), [sessions]);

  const headerConfig = {
    title: "Calls",
    actions: [
      {
        id: "new-call",
        label: "New Call",
        icon: PhoneCall,
        event: startNewCallClicked,
        variant: "default" as const,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshSessionsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const handleRowClick = (row: CallRow) => {
    if (!row?.id || !bus) return;
    // Mount the call's transcript view (CallTranscriptView) in the right
    // sidebar — the VIEW_CALL action already presents it as a widget.
    bus.run("calls.view", { sessionId: row.id });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={rows}
        columns={callsColumns}
        loading={loading}
        hasMore={false}
        onRowClick={handleRowClick}
        viewMode="table"
        emptyMessage="No call sessions yet."
      />
    </HeaderPanelLayout>
  );
};
