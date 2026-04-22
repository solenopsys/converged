import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import {
	$classifierNodesStore,
	classifierNodesViewMounted,
	refreshClassifierNodesClicked,
} from "../domain-classifier";
import { classifierNodeColumns } from "../functions/columns";

export const ClassifierNodesView = () => {
	const nodesState = useUnit($classifierNodesStore.$state);

	useEffect(() => {
		classifierNodesViewMounted();
	}, []);

	const headerConfig = {
		title: "Classifier",
		subtitle: "Entities",
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshClassifierNodesClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={nodesState.items}
				hasMore={nodesState.hasMore}
				loading={nodesState.loading}
				columns={classifierNodeColumns}
				onLoadMore={$classifierNodesStore.loadMore}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};
