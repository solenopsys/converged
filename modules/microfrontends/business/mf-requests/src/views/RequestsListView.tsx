import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	useMicrofrontendTranslation,
} from "front-core";
import { RefreshCw } from "front-core";
import { useEffect, useMemo } from "preact/compat";
import { OPEN_REQUEST } from "../commands";
import { createRequestsColumns } from "../config";
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
	const { t } = useMicrofrontendTranslation("requests-mf");

	useEffect(() => {
		requestsListMounted();
	}, []);

	const columns = useMemo(() => createRequestsColumns(t), [t]);

	const headerConfig = {
		title: t("list.title"),
		actions: [
			{
				id: "refresh",
				label: t("list.refresh"),
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
				columns={columns}
				onRowClick={handleRowClick}
				onLoadMore={$requestsStore.loadMore}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};
