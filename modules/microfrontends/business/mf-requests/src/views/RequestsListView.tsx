import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	useMicrofrontendTranslation,
} from "front-core";
import { RefreshCw } from "front-core";
import { objectRef, presentReference } from "front-core/object-runtime";
import { useEffect, useMemo } from "preact/compat";
import { createRequestsColumns } from "../config";
import {
	$requestsStore,
	refreshRequestsClicked,
	requestsListMounted,
} from "../domain-requests";

export const RequestsListView = () => {
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
		void presentReference(objectRef("requests.request", id));
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
