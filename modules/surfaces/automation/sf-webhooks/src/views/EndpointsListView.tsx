import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	Plus,
	RefreshCw,
} from "front-core";
import React, { useEffect } from "preact/compat";
import {
	$endpointsStore,
	addEndpointClicked,
	endpointsViewMounted,
	openEndpointForm,
	refreshEndpointsClicked,
} from "../domain-endpoints";
import { endpointColumns } from "../functions/columns";
import { createEndpointFormWidget } from "../functions/endpoints.config";

export const EndpointsListView = ({ bus }) => {
	const endpointsState = useUnit($endpointsStore.$state);

	useEffect(() => {
		endpointsViewMounted();

		const unwatch = addEndpointClicked.watch(() => {
			openEndpointForm({ endpoint: null });
			bus.present({ widget: createEndpointFormWidget(bus) });
		});

		return () => unwatch();
	}, [bus]);

	const headerConfig = {
		title: "Webhooks",
		actions: [
			{
				id: "add",
				label: "Add Endpoint",
				icon: Plus,
				event: addEndpointClicked,
				variant: "default" as const,
			},
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshEndpointsClicked,
				variant: "outline" as const,
			},
		],
	};

	const handleRowClick = (row) => {
		openEndpointForm({ endpoint: row });
		bus.present({
			widget: createEndpointFormWidget(bus),
			params: { entity: row },
			tab: {
				key: `webhooks.endpoint:${row.id}`,
				title: row.name ?? row.path ?? row.id,
			},
		});
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={endpointsState.items}
				hasMore={endpointsState.hasMore}
				loading={endpointsState.loading}
				columns={endpointColumns}
				onLoadMore={$endpointsStore.loadMore}
				onRowClick={handleRowClick}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};

export default EndpointsListView;
