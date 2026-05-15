import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { OPEN_REQUEST } from "../commands";
import { requestsColumns } from "../config";
import {
	$requestsStore,
	openRequestDetail,
	refreshRequestsClicked,
	requestsListMounted,
} from "../domain-requests";

type RequestBus = {
	run?: (actionId: string, params?: unknown) => unknown;
};

export const RequestsListView = ({ bus }: { bus?: RequestBus }) => {
	const state = useUnit($requestsStore.$state);

	useEffect(() => {
		requestsListMounted();
	}, []);

	const headerConfig = {
		title: "Заявки",
		actions: [
			{
				id: "refresh",
				label: "Обновить",
				icon: RefreshCw,
				event: refreshRequestsClicked,
				variant: "outline" as const,
			},
		],
	};

	const handleRowClick = (row: unknown) => {
		const id =
			row && typeof row === "object" && "id" in row
				? (row as { id?: unknown }).id
				: undefined;
		if (typeof id !== "string" || id.length === 0) return;
		openRequestDetail({ recordId: id });
		bus?.run?.(OPEN_REQUEST, { requestId: id });
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={state.items}
				hasMore={state.hasMore}
				loading={state.loading}
				columns={requestsColumns}
				onRowClick={handleRowClick}
				onLoadMore={$requestsStore.loadMore}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};
