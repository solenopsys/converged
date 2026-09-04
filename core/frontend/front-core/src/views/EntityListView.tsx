import type { Store } from "effector";
import { createEvent, createStore } from "effector";
import { useUnit } from "effector-preact";
import { translator } from "i18n";
import type * as React from "preact/compat";
import { useCallback, useEffect, useMemo, useState } from "preact/compat";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import {
	$objectRegistryRevision,
	type DomainRef,
	executeOperation,
	objectChanged,
	localized,
	operationsFor,
	type OwnedOperation,
	setRef,
} from "../object-runtime";
import {
	hasParameters,
	OperationParametersDialog,
} from "./OperationParametersDialog";
import type {
	HeaderAction,
	HeaderPanelConfig,
	SelectionAction,
} from "../components/HeaderPanel";
import { HeaderPanelLayout } from "../components/HeaderPanelLayout";
import { RefreshCw } from "../icons";
import type {
	TableFilterConfig,
	TableFilterValues,
} from "../table/filter-header";
import { valuesFromSelectionFilter } from "../table/filter-header";
import { InfiniteScrollDataTable } from "../table/InfiniteScrollDataTable";
import type { InfiniteTableStore } from "../table/infinite-table-store";
import type {
	BulkAction,
	ColumnConfig,
	RowCardProps,
	RowId,
	TableCommand,
	ViewMode,
} from "../table/types";

const t = translator(CHAT_MESSAGES_NAMESPACE);

export type EntityListTab<TData extends object = Record<string, unknown>> = {
	id: string;
	label: string;
	badge?: string | number;

	store?: InfiniteTableStore;

	filters?: TableFilterValues;
	columns?: Array<ColumnConfig<TData>>;
	CardComponent?: React.ComponentType<RowCardProps<TData>> | null;
	emptyMessage?: string;
};

export interface EntityListViewProps<
	TData extends object = Record<string, unknown>,
> {
	tableId: string;
	/**
	 * What this table is a view of. With it the list publishes the operations
	 * the runtime says apply to this collection, so a command is declared next
	 * to the object type rather than configured here.
	 */
	reference?: DomainRef;
	store?: InfiniteTableStore;
	columns: Array<ColumnConfig<TData>>;
	title?: string;
	subtitle?: string;

	actions?: HeaderAction[];
	selectionActions?: SelectionAction[];
	refreshable?: boolean;
	refreshLabel?: string;

	filters?: TableFilterConfig[];

	baseFilters?: TableFilterValues;
	serializeFilters?: (
		values: TableFilterValues,
		baseFilters: TableFilterValues | undefined,
	) => TableFilterValues;
	tabs?: Array<EntityListTab<TData>>;

	$activeTab?: Store<string>;
	tabChanged?: (tabId: string) => void;
	onRowClick?: (rowData: TData) => void;
	CardComponent?: React.ComponentType<RowCardProps<TData>> | null;
	viewMode?: ViewMode;
	selectable?: boolean;
	bulkActions?: BulkAction[];
	onBulkAction?: (actionId: string, rows: TData[], rowIds: RowId[]) => void;
	emptyMessage?: string;
	className?: string;
}

const cleanFilters = (values: TableFilterValues): TableFilterValues => {
	const result: TableFilterValues = {};
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined || value === null || value === "") continue;
		result[key] = value;
	}
	return result;
};

export function EntityListView<TData extends object = Record<string, unknown>>({
	tableId,
	reference,
	store,
	columns,
	title,
	subtitle,
	actions,
	selectionActions,
	refreshable = true,
	refreshLabel = "Refresh",
	filters,
	baseFilters,
	serializeFilters,
	tabs,
	$activeTab,
	tabChanged,
	onRowClick,
	CardComponent,
	viewMode = "table",
	selectable = true,
	bulkActions,
	onBulkAction,
	emptyMessage,
	className,
}: EntityListViewProps<TData>) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: tab state must be created once per instance
	const internalTabState = useMemo(() => {
		const changed = createEvent<string>();
		const $active = createStore(tabs?.[0]?.id ?? "").on(
			changed,
			(_, value) => value,
		);
		return { $active, changed };
	}, []);

	const $tab = $activeTab ?? internalTabState.$active;
	const onTabChanged = tabChanged ?? internalTabState.changed;
	const activeTabId = useUnit($tab);

	const activeTab = tabs?.find((tab) => tab.id === activeTabId) ?? tabs?.[0];
	const activeStore = activeTab?.store ?? store;
	if (!activeStore) {
		throw new Error(
			`EntityListView(${tableId}): no store — pass "store" or per-tab "store"`,
		);
	}

	const state = useUnit(activeStore.$state);
	const [filterValues, setFilterValues] = useState<TableFilterValues>({});
	const selectionFilterValues = useMemo(
		() => valuesFromSelectionFilter(filters, baseFilters),
		[baseFilters, filters],
	);
	const displayedFilterValues = useMemo(
		() => ({ ...selectionFilterValues, ...filterValues }),
		[filterValues, selectionFilterValues],
	);

	const mergedFilters = useMemo(() => {
		const values = cleanFilters({ ...activeTab?.filters, ...filterValues });
		return serializeFilters
			? cleanFilters(serializeFilters(values, baseFilters))
			: cleanFilters({ ...baseFilters, ...values });
	}, [activeTab?.filters, baseFilters, filterValues, serializeFilters]);

	// Push filters into the store only when they actually differ; setFilters
	// resets pagination and triggers a reload by itself.
	useEffect(() => {
		const current = activeStore.$state.getState().filters;
		if (JSON.stringify(current) !== JSON.stringify(mergedFilters)) {
			activeStore.setFilters(mergedFilters);
		}
	}, [activeStore, mergedFilters]);

	// A record of this type was written somewhere — a form, a command, the
	// assistant — so the list showing it is stale. The view does not need to
	// know which screen did it.
	useEffect(() => {
		if (!reference) return;
		return objectChanged.watch(({ ref }) => {
			if (ref.type === reference.type) activeStore.refresh();
		});
	}, [activeStore, reference]);

	// Initial load for the active store (also covers switching to a fresh tab).
	useEffect(() => {
		const current = activeStore.$state.getState();
		if (!current.isInitialized && !current.loading && !current.loadingMore) {
			activeStore.loadMore({});
		}
	}, [activeStore]);

	// ---- commands published by the object runtime -------------------------
	// Ticked rows are an explicit subset; without them the command applies to
	// everything the filter matches, which is the whole point of filtering
	// first. Either way it travels as one reference, never as a list of rows.
	const [selectedIds, setSelectedIds] = useState<RowId[]>([]);
	const [pending, setPending] = useState<OwnedOperation | null>(null);
	const [commandBusy, setCommandBusy] = useState(false);
	const [commandError, setCommandError] = useState<string | undefined>();
	const [selectionResetKey, setSelectionResetKey] = useState(0);
	useUnit($objectRegistryRevision);

	const commandRef = useMemo((): DomainRef | undefined => {
		if (!reference || reference.kind !== "set") return reference;
		if (selectedIds.length > 0)
			return setRef(reference.type, {
				kind: "ids",
				ids: selectedIds.map(String),
			});
		return setRef(reference.type, {
			kind: "query",
			...(mergedFilters.filter
				? { filter: mergedFilters.filter as Record<string, unknown> }
				: {}),
			...(Array.isArray(mergedFilters.presets) && mergedFilters.presets.length
				? { presets: mergedFilters.presets as never }
				: {}),
		});
	}, [mergedFilters, reference, selectedIds]);

	const operations = useMemo(
		() => (commandRef ? operationsFor(commandRef) : []),
		[commandRef],
	);

	const commands = useMemo<TableCommand[]>(
		() =>
			operations.map((operation) => ({
				id: operation.id,
				label:
					localized(operation.owner, operation.labelKey, operation.label) ??
					operation.label,
				...(operation.description
					? { description: operation.description }
					: {}),
			})),
		[operations],
	);

	const runOperation = useCallback(
		async (operation: OwnedOperation, params: Record<string, unknown>) => {
			if (!commandRef) return;
			setCommandBusy(true);
			setCommandError(undefined);
			try {
				await executeOperation({
					operationId: operation.id,
					references: [commandRef],
					params,
					source: "user",
				});
				setPending(null);
				setSelectedIds([]);
				setSelectionResetKey((key) => key + 1);
				activeStore.refresh();
			} catch (error) {
				setCommandError(
					t("operation.failed", {
						message: error instanceof Error ? error.message : String(error),
					}),
				);
			} finally {
				setCommandBusy(false);
			}
		},
		[activeStore, commandRef],
	);

	const handleCommand = useCallback(
		(commandId: string) => {
			const operation = operations.find((item) => item.id === commandId);
			if (!operation) return;
			setCommandError(undefined);
			if (hasParameters(operation.parameters)) {
				setPending(operation);
				return;
			}
			void runOperation(operation, {});
		},
		[operations, runOperation],
	);

	const commandScopeLabel =
		commands.length > 0
			? t(
					Object.keys(mergedFilters).length > 0
						? "table.commandScopeFiltered"
						: "table.commandScopeAll",
					{ total: (state.totalCount ?? state.items.length).toLocaleString() },
				)
			: undefined;

	const headerConfig: HeaderPanelConfig = {
		title,
		subtitle,
		...(tabs && tabs.length > 0
			? {
					tabs: tabs.map((tab) => ({
						id: tab.id,
						label: tab.label,
						value: tab.id,
						badge: tab.badge,
					})),
					$activeTab: $tab,
					tabChanged: onTabChanged,
				}
			: {}),
		actions: [
			...(actions ?? []),
			...(refreshable
				? [
						{
							id: "__list_refresh",
							label: refreshLabel,
							icon: RefreshCw,
							event: activeStore.refresh,
							variant: "outline" as const,
						},
					]
				: []),
		],
		selectionActions,
	};

	const handleSort = (columnId: string, direction: "asc" | "desc") => {
		activeStore.setSort({ key: columnId, direction });
	};

	return (
		<HeaderPanelLayout config={headerConfig} className={className}>
			{commandError && !pending && (
				<div
					className="border-b border-destructive/40 bg-destructive/10 px-6 py-2 text-sm text-destructive"
					role="alert"
				>
					{commandError}
				</div>
			)}
			<div className="min-h-0 flex-1">
				<InfiniteScrollDataTable<TData>
					tableId={tabs ? `${tableId}:${activeTabId}` : tableId}
					columns={activeTab?.columns ?? columns}
					data={state.items as TData[]}
					hasMore={state.hasMore}
					loading={state.loading}
					loadingMore={state.loadingMore}
					totalCount={state.totalCount}
					sortConfig={state.sortConfig}
					onSort={handleSort}
					onLoadMore={activeStore.loadMore}
					onRowClick={onRowClick}
					CardComponent={activeTab?.CardComponent ?? CardComponent}
					viewMode={viewMode}
					selectable={selectable}
					bulkActions={bulkActions}
					onBulkAction={onBulkAction}
					commands={commands}
					onCommand={handleCommand}
					{...(commandScopeLabel ? { commandScopeLabel } : {})}
					selectionResetKey={selectionResetKey}
					onSelectionChange={setSelectedIds}
					emptyMessage={activeTab?.emptyMessage ?? emptyMessage}
					filters={filters}
					filterValues={displayedFilterValues}
					onFilterValuesChange={setFilterValues}
				/>
			</div>
			{pending && pending.parameters && (
				<OperationParametersDialog
					title={
						localized(pending.owner, pending.labelKey, pending.label) ??
						pending.label
					}
					{...(pending.description
						? { description: pending.description }
						: {})}
					parameters={pending.parameters}
					busy={commandBusy}
					{...(commandError ? { error: commandError } : {})}
					onCancel={() => setPending(null)}
					onSubmit={(params) => void runOperation(pending, params)}
				/>
			)}
		</HeaderPanelLayout>
	);
}
