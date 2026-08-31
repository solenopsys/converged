import { useUnit } from "effector-preact";
import {
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	Plus,
	RefreshCw,
} from "front-core";
import { presentReference } from "front-core/object-runtime";
import type { ContextSummary } from "g-contexts";
import { useEffect } from "preact/hooks";
import { contextsColumns } from "../config";
import { contextRef, newContextRef } from "../context";
import {
	$contextsStore,
	contextsViewMounted,
	refreshContextsClicked,
} from "../domain-contexts";

type ContextTableRow = Omit<ContextSummary, "updatedAt"> & {
	updatedAt: string;
};

export const ContextsListView = () => {
	const contextsState = useUnit($contextsStore.$state);

	useEffect(() => {
		contextsViewMounted();
	}, []);

	const headerConfig = {
		title: "Contexts",
		actions: [
			{
				id: "new",
				label: "New",
				icon: Plus,
				event: () => void presentReference(newContextRef()),
				variant: "default" as const,
			},
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshContextsClicked,
				variant: "outline" as const,
			},
		],
	};

	const items: ContextTableRow[] = (
		(contextsState.items ?? []) as ContextSummary[]
	).map((item) => ({
		...item,
		updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-",
		size: item.size ?? "-",
	}));

	const handleRowClick = (row: ContextTableRow) => {
		if (!row?.name) return;
		void presentReference(
			contextRef({ name: row.name, language: row.language }),
		);
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<InfiniteScrollDataTable
				data={items}
				hasMore={contextsState.hasMore}
				loading={contextsState.loading}
				columns={contextsColumns}
				onLoadMore={$contextsStore.loadMore}
				onRowClick={handleRowClick}
				viewMode="table"
			/>
		</HeaderPanelLayout>
	);
};
