import type { Store } from "effector";
import { createDomain } from "effector";
import { useUnit } from "effector-preact";
import {
	$objectRegistryRevision,
	type DomainRef,
	executeOperation,
	localized,
	type OwnedOperation,
	objectChanged,
	objectRef,
	objectRegistry,
	operationsFor,
	presentReference,
	rememberObjectSnapshot,
	setRef,
} from "front-core/object-runtime";
import { translator } from "i18n";
import type * as React from "preact/compat";
import { useCallback, useEffect, useMemo, useState } from "preact/compat";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
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
import { createInfiniteTableStore } from "../table/infinite-table-store";
import type {
	BulkAction,
	ColumnConfig,
	RowCardProps,
	RowId,
	TableCommand,
	ViewMode,
} from "../table/types";
import {
	hasParameters,
	OperationParametersDialog,
} from "./OperationParametersDialog";

const t = translator(CHAT_MESSAGES_NAMESPACE);
const infinityDomain = createDomain("FRONT_CORE_INFINITY_TABLES");

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
	tableId?: string;
	/**
	 * What this table is a view of. With it the list publishes the operations
	 * the runtime says apply to this collection, so a command is declared next
	 * to the object type rather than configured here.
	 */
	reference?: DomainRef;
	store?: InfiniteTableStore;
	columns?: Array<ColumnConfig<TData>>;
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

export function referenceBaseFilters(
	reference: DomainRef | undefined,
): TableFilterValues | undefined {
	if (
		!reference ||
		reference.kind !== "set" ||
		reference.selection.kind !== "query"
	) {
		return undefined;
	}
	const { filter, presets } = reference.selection;
	if (!filter && !presets?.length) return undefined;
	return {
		...(filter ? { filter } : {}),
		...(presets?.length ? { presets } : {}),
	};
}

export function infinityFilterParams(
	values: TableFilterValues,
	base: TableFilterValues | undefined,
	filters:
		| readonly (TableFilterConfig & {
				operator?: string;
				valueType?: "string" | "number" | "boolean" | "date";
		  })[]
		| undefined,
): TableFilterValues {
	const definitions = new Map(
		(filters ?? []).map((filter) => [filter.id, filter]),
	);
	const clauses: Record<string, unknown> = {};
	for (const [field, value] of Object.entries(values)) {
		if (value === undefined || value === null || value === "") continue;
		const definition = definitions.get(field);
		const operator = definition?.operator;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			if (operator === "between") {
				const [from, to] = value;
				if (from && to) clauses[field] = { between: [from, to] };
				else if (from) clauses[field] = { gte: from };
				else if (to) clauses[field] = { lte: to };
				continue;
			}
			clauses[field] = { [operator ?? "in"]: value };
			continue;
		}
		let normalized: unknown = value;
		if (
			definition?.valueType === "boolean" &&
			(value === "true" || value === "false")
		) {
			normalized = value === "true";
		} else if (definition?.valueType === "number" && value !== "") {
			const number = Number(value);
			if (Number.isFinite(number)) normalized = number;
		}
		clauses[field] = { [operator ?? "contains"]: normalized };
	}
	const baseFilter = base?.filter as Record<string, unknown> | undefined;
	const filter =
		baseFilter && Object.keys(clauses).length > 0
			? { AND: [baseFilter, clauses] }
			: Object.keys(clauses).length > 0
				? clauses
				: baseFilter;
	return {
		...(filter ? { filter } : {}),
		...(Array.isArray(base?.presets) && base.presets.length > 0
			? { presets: base.presets }
			: {}),
	};
}

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
	const objectType = reference
		? objectRegistry.type(reference.type)
		: undefined;
	const infinity = objectType?.infinity;
	const resolvedTableId =
		tableId ?? infinity?.tableId ?? reference?.type ?? "entity-list";
	const referenceQueryKey = useMemo(
		() =>
			JSON.stringify(
				reference?.kind === "set"
					? { type: reference.type, selection: reference.selection }
					: reference
						? { type: reference.type, kind: reference.kind, id: reference.id }
						: null,
			),
		[reference],
	);
	const projectionStore = useMemo(() => {
		if (infinity?.store) return infinity.store;
		const load = infinity?.load;
		if (!load || !objectType) return undefined;
		return createInfiniteTableStore<unknown>(
			infinityDomain,
			(params) =>
				load(params) as Promise<
					| {
							items?: unknown[];
							totalCount?: number;
					  }
					| null
					| undefined
				>,
			JSON.stringify({ tableId: resolvedTableId, referenceQueryKey }),
		);
	}, [infinity, objectType, referenceQueryKey, resolvedTableId]);
	const resolvedBaseFilters = baseFilters ?? referenceBaseFilters(reference);
	const resolvedFilters = filters ?? infinity?.filters;
	const resolvedColumns = columns ?? infinity?.columns;
	const resolvedTitle =
		title ?? infinity?.title ?? objectType?.pluralLabel ?? objectType?.label;
	const resolvedActions = actions ?? infinity?.actions;
	const configuredTabs = useMemo<EntityListTab<TData>[]>(
		() =>
			infinity?.presets
				?.filter((preset) => preset.control === "tab")
				.map((preset) => ({ id: preset.id, label: preset.label })) ?? [],
		[infinity?.presets],
	);
	const resolvedTabs =
		tabs ?? (configuredTabs.length > 0 ? configuredTabs : undefined);
	const resolvedSerializeFilters =
		serializeFilters ??
		(infinity
			? (values: TableFilterValues, base: TableFilterValues | undefined) =>
					infinityFilterParams(values, base, infinity.filters)
			: undefined);

	const tableStateStore = store ?? projectionStore;
	const tabStateStore =
		tableStateStore ?? resolvedTabs?.find((tab) => tab.store)?.store;
	if (!tabStateStore) {
		throw new Error(
			`EntityListView(${resolvedTableId}): no store — configure infinity.store or infinity.load`,
		);
	}
	const $tab = $activeTab ?? tabStateStore.$activeTab;
	const rememberTab = useCallback(
		(tabId: string) => {
			tabStateStore.setHeader({ activeTabId: tabId });
		},
		[tabStateStore],
	);
	const configuredTabChanged = useCallback(
		(tabId: string) => {
			if (!infinity?.presets || !reference || reference.kind !== "set") {
				rememberTab(tabId);
				return;
			}
			const selected = infinity.presets.find((preset) => preset.id === tabId);
			if (!selected) return;
			const current =
				reference.selection.kind === "query"
					? reference.selection
					: { kind: "query" as const };
			const nextPresets = (current.presets ?? []).filter((preset) => {
				const definition = infinity.presets?.find(
					(item) => item.id === preset.id,
				);
				return definition?.group !== selected.group;
			});
			nextPresets.push({
				id: selected.id,
				...(selected.defaults ? { params: selected.defaults } : {}),
			});
			void presentReference(
				setRef(reference.type, {
					kind: "query",
					...(current.filter ? { filter: current.filter } : {}),
					presets: nextPresets,
				}),
				{ title: reference.title },
			);
		},
		[infinity, reference, rememberTab],
	);
	const onTabChanged =
		tabChanged ??
		(configuredTabs.length > 0 ? configuredTabChanged : rememberTab);
	const activeTabId = useUnit($tab);

	const activeTab =
		resolvedTabs?.find((tab) => tab.id === activeTabId) ?? resolvedTabs?.[0];
	const selectedConfiguredPreset =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.presets?.find((preset) =>
					infinity?.presets?.some((definition) => definition.id === preset.id),
				)
			: undefined;
	useEffect(() => {
		if (selectedConfiguredPreset) {
			tabStateStore.setHeader({ activeTabId: selectedConfiguredPreset.id });
		}
	}, [selectedConfiguredPreset, tabStateStore]);
	const activeStore = activeTab?.store ?? store ?? projectionStore;
	if (!activeStore) {
		throw new Error(
			`EntityListView(${resolvedTableId}): no store — configure infinity.store or infinity.load`,
		);
	}
	if (!resolvedColumns) {
		throw new Error(
			`EntityListView(${resolvedTableId}): no columns — configure infinity on '${reference?.type ?? "unknown"}'`,
		);
	}

	const state = useUnit(activeStore.$state);
	useEffect(() => {
		if (!reference) return;
		for (const row of state.items) {
			const item = row as Record<string, unknown>;
			if (item.id !== undefined && item.id !== null)
				rememberObjectSnapshot(reference.type, String(item.id), item);
		}
	}, [reference, state.items]);
	const filterValues = state.header.filterValues as TableFilterValues;
	const setFilterValues = (values: TableFilterValues) =>
		activeStore.setHeader({ filterValues: values });
	const selectionFilterValues = useMemo(
		() => valuesFromSelectionFilter(resolvedFilters, resolvedBaseFilters),
		[resolvedBaseFilters, resolvedFilters],
	);
	const displayedFilterValues = useMemo(
		() => ({ ...selectionFilterValues, ...filterValues }),
		[filterValues, selectionFilterValues],
	);

	const mergedFilters = useMemo(() => {
		const values = cleanFilters({ ...activeTab?.filters, ...filterValues });
		return resolvedSerializeFilters
			? cleanFilters(resolvedSerializeFilters(values, resolvedBaseFilters))
			: cleanFilters({ ...resolvedBaseFilters, ...values });
	}, [
		activeTab?.filters,
		filterValues,
		resolvedBaseFilters,
		resolvedSerializeFilters,
	]);

	// Query identity is kept with the table state, not in this component: a
	// remount of the same projection must not turn into an accidental refresh.
	useEffect(() => {
		const referenceChanged = state.header.referenceKey !== referenceQueryKey;
		if (referenceChanged)
			activeStore.setHeader({ referenceKey: referenceQueryKey });
		const current = activeStore.$state.getState().filters;
		if (JSON.stringify(current) !== JSON.stringify(mergedFilters)) {
			activeStore.setFilters(mergedFilters);
			return;
		}
		if (referenceChanged && state.isInitialized && infinity?.store) {
			activeStore.setFilters(mergedFilters);
		}
	}, [
		activeStore,
		infinity?.store,
		mergedFilters,
		referenceQueryKey,
		state.header.referenceKey,
		state.isInitialized,
	]);

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
	const selectedIds = state.header.selectedIds as RowId[];
	const setSelectedIds = (ids: RowId[]) =>
		activeStore.setHeader({ selectedIds: ids });
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
		title: resolvedTitle,
		subtitle,
		...(resolvedTabs && resolvedTabs.length > 0
			? {
					tabs: resolvedTabs.map((tab) => ({
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
			...(resolvedActions ?? []),
			...(refreshable
				? [
						{
							id: "__list_refresh",
							label: refreshLabel,
							icon: RefreshCw as HeaderAction["icon"],
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
			{/* The layout slot is a plain block, so the table only gets a bounded
			    height — and therefore a scrollbar — through this flex column. */}
			<div className="flex h-full min-h-0 flex-col">
				{commandError && !pending && (
					<div
						className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-6 py-2 text-sm text-destructive"
						role="alert"
					>
						{commandError}
					</div>
				)}
				<div className="min-h-0 flex-1">
					<InfiniteScrollDataTable<TData>
						tableId={
							resolvedTabs
								? `${resolvedTableId}:${activeTabId}`
								: resolvedTableId
						}
						columns={activeTab?.columns ?? resolvedColumns}
						data={state.items as TData[]}
						hasMore={state.hasMore}
						loading={state.loading}
						loadingMore={state.loadingMore}
						totalCount={state.totalCount}
						sortConfig={state.sortConfig}
						onSort={handleSort}
						onLoadMore={activeStore.loadMore}
						onRowClick={
							onRowClick ??
							(infinity
								? (row) => {
										const item = row as Record<string, unknown>;
										const target = infinity.rowRef
											? infinity.rowRef(row as Record<string, unknown>)
											: objectRef(reference?.type ?? "", String(item.id));
										void presentReference(
											target.kind === "object"
												? { ...target, data: item }
												: target,
										);
									}
								: undefined)
						}
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
						filters={resolvedFilters ? [...resolvedFilters] : undefined}
						filterValues={displayedFilterValues}
						onFilterValuesChange={setFilterValues}
					/>
				</div>
			</div>
			{pending && pending.parameters && (
				<OperationParametersDialog
					title={
						localized(pending.owner, pending.labelKey, pending.label) ??
						pending.label
					}
					{...(pending.description ? { description: pending.description } : {})}
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
