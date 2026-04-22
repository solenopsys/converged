import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import {
	$classifierMappings,
	$classifierMappingsLoading,
	CLASSIFIER_SERVICES_GROUP,
	classifierMappingsViewMounted,
	refreshClassifierMappingsClicked,
} from "../domain-classifier";
import { classifierMappingColumns } from "../functions/columns";

export const ClassifierMappingsView = () => {
	const mappings = useUnit($classifierMappings);
	const loading = useUnit($classifierMappingsLoading);

	useEffect(() => {
		classifierMappingsViewMounted();
	}, []);

	const headerConfig = {
		title: "Classifier",
		subtitle: CLASSIFIER_SERVICES_GROUP,
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshClassifierMappingsClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={mappings}
				hasMore={false}
				loading={loading}
				columns={classifierMappingColumns}
				onLoadMore={() => undefined}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};
