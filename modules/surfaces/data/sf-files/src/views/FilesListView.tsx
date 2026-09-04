import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	RefreshCw,
} from "front-core";
import { useEffect } from "preact/compat";
import { fileColumns } from "../columns";
import {
	$filesStore,
	filesViewMounted,
	refreshFilesClicked,
} from "../domain-files";

export const FilesListView = () => {
	const state = useUnit($filesStore.$state);

	useEffect(() => {
		filesViewMounted();
	}, []);

	return (
		<HeaderPanelLayout
			config={{
				title: "Files",
				actions: [
					{
						id: "refresh",
						label: "Refresh",
						icon: RefreshCw,
						event: refreshFilesClicked,
						variant: "outline" as const,
					},
				],
			}}
		>
			<InfiniteScrollDataTable
				data={state.items}
				hasMore={state.hasMore}
				loading={state.loading}
				columns={fileColumns}
				filters={[
					{
						id: "name",
						type: "search",
						placeholder: "Filter files",
						debounceMs: 300,
					},
				]}
				filterValues={state.filters}
				onFilterValuesChange={$filesStore.setFilters}
				onLoadMore={$filesStore.loadMore}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};
