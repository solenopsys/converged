import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	Plus,
	RefreshCw,
	Trash2,
} from "front-core";
import React, { useEffect } from "preact/compat";
import {
	$cronsStore,
	addCronClicked,
	cronsViewMounted,
	openCronForm,
	refreshCronsClicked,
} from "../domain-crons";
import { cronsColumns } from "../functions/columns";
import { createCronFormWidget } from "../functions/crons.config";
import shedullerService from "../service";

export const CronsListView = ({ bus }) => {
	const cronsState = useUnit($cronsStore.$state);

	useEffect(() => {
		cronsViewMounted();

		const unwatch = addCronClicked.watch(() => {
			openCronForm({ cron: null });
			bus.present({ widget: createCronFormWidget(bus) });
		});

		return () => {
			unwatch();
		};
	}, [bus]);

	const handleRowClick = (row) => {
		openCronForm({ cron: row });
		bus.present({
			widget: createCronFormWidget(bus),
			params: { entity: row },
			tab: { key: `sheduller.cron:${row.id}`, title: row.name ?? row.id },
		});
	};

	const headerConfig = {
		title: "Crons",
		actions: [
			{
				id: "add",
				label: "Add Cron",
				icon: Plus,
				event: addCronClicked,
				variant: "default" as const,
			},
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshCronsClicked,
				variant: "outline" as const,
			},
		],
		selectionActions: [
			{
				id: "delete",
				label: (count: number) => `Delete (${count})`,
				icon: Trash2,
				variant: "destructive" as const,
				handler: async (rows) => {
					await Promise.all(
						rows.map((row) => shedullerService.deleteCron(row.id)),
					);
					refreshCronsClicked();
				},
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={cronsState.items}
				hasMore={cronsState.hasMore}
				loading={cronsState.loading}
				columns={cronsColumns}
				onLoadMore={$cronsStore.loadMore}
				onRowClick={handleRowClick}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};

export default CronsListView;
