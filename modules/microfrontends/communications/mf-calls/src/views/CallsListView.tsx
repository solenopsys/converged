import { createDomain } from "effector";
import { useUnit } from "effector-preact";
import { createInfiniteTableStore, HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { PhoneCall, RefreshCw } from "front-core";
import {
	objectRef,
	presentReference,
	type SetRef,
} from "front-core/object-runtime";
import type { CallsListParams } from "g-calls";
import { useEffect, useMemo } from "preact/compat";
import {
	callsClient,
	startNewCallClicked,
} from "../domain-calls";
import { callsColumns, type CallRow } from "../config";

type CallsListViewProps = { reference?: SetRef };

export const CallsListView = ({ reference }: CallsListViewProps) => {
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
    if (!row?.id) return;
    // Present the call itself; the shell resolves calls.call.detail and opens
    // CallDetailView in a workspace tab, same as the other list views.
    void presentReference(objectRef("calls.call", row.id));
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
