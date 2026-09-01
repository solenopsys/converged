import { createDomain } from "effector";
import { useUnit } from "effector-preact";
import { createInfiniteTableStore, HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { PhoneCall, RefreshCw } from "front-core";
import type { SetRef } from "front-core/object-runtime";
import type { CallsListParams } from "g-calls";
import { useEffect, useMemo } from "preact/compat";
import {
	callsClient,
	startNewCallClicked,
} from "../domain-calls";
import { callsColumns, type CallRow } from "../config";

type CallsListViewProps = { bus?: any; reference?: SetRef };

export const CallsListView = ({ bus, reference }: CallsListViewProps) => {
	const store = useMemo(() => {
		const domain = createDomain(`calls-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) => callsClient.listCalls(params as CallsListParams));
	}, []);
	const state = useUnit(store.$state);
	const filter = reference?.kind === "set" && reference.selection.kind === "query" ? reference.selection.filter : undefined;

	useEffect(() => {
		store.setFilters(filter ? { filter } : {});
	}, [filter, store]);

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
		 event: store.refresh,
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
			tableId="calls"
			data={state.items as CallRow[]}
			totalCount={state.totalCount}
			columns={callsColumns}
			loading={state.loading}
			loadingMore={state.loadingMore}
			hasMore={state.hasMore}
			onLoadMore={store.loadMore}
        onRowClick={handleRowClick}
        viewMode="table"
        emptyMessage="No call sessions yet."
      />
    </HeaderPanelLayout>
  );
};
