import { useUnit } from "effector-preact";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	CheckSquare,
	ChevronDown as MenuIcon,
	Square,
} from "../icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import {
	$tableColumnsState,
	setColumnWidthAtIndex,
	setColumnWidths,
} from "./columns-store";
import {
	cn,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenu as ShadDropdown,
} from "front-core";
import { CellRenderer } from "./CellRenderer";
import { ColumnResizer } from "./ColumnResizer";
import { DefaultRowCard } from "./DefaultRowCard";
import {
	normalizeBoolean,
	normalizeBulkActions,
	normalizeColumns,
	normalizeNumber,
	normalizeRows,
	normalizeViewMode,
	resolveFallbackColumnWidths,
	resolveInitialColumnWidths,
} from "./helpers";
import type {
	InfiniteScrollDataTableProps,
	RowCardProps,
	RowId,
	SortConfig,
	TableRowBase,
	ViewMode,
} from "./types";
import { getRowId, getRowValue, hasRowId } from "./row-utils";
import { useVirtualRows } from "./use-virtual-rows";

export type {
	BulkAction,
	ColumnAction,
	ColumnConfig,
	InfiniteScrollDataTableProps,
	RowActionHandler,
	RowCardProps,
	RowId,
	SortConfig,
	ViewMode,
} from "./types";

const LOAD_MORE_THRESHOLD = 200;
// prefetch only fills the first viewport; scrolling drives everything after that
const MAX_AUTO_FILL_ROUNDS = 5;

export function InfiniteScrollDataTable<TData extends object = TableRowBase>({
	columns: columnsInput = [],
	data: dataInput = [],
	hasMore: hasMoreInput = true,
	loading: loadingInput = false,
	loadingMore: loadingMoreInput = false,
	viewMode = "table",
	tableId = "default-table",
	CardComponent = null,
	responsiveBreakpoint: responsiveBreakpointInput = 768,
	onLoadMore,
	onSort,
	sortConfig: sortConfigInput,
	onRowAction,
	onRowClick,
	onBulkAction,
	onSelectionChange,
	bulkActions: bulkActionsInput = [],
	selectable: selectableInput = true,
	totalCount: totalCountInput = 0,
	className = "",
	tableClassName = "",
	emptyMessage = "Данные не найдены",
}: InfiniteScrollDataTableProps<TData>) {
	const columns = useMemo(
		() => normalizeColumns<TData>(columnsInput),
		[columnsInput],
	);
	const data = useMemo(() => normalizeRows<TData>(dataInput), [dataInput]);
	const bulkActions = useMemo(
		() => normalizeBulkActions(bulkActionsInput),
		[bulkActionsInput],
	);
	const hasMore = normalizeBoolean(hasMoreInput, true);
	const loading = normalizeBoolean(loadingInput, false);
	const loadingMore = normalizeBoolean(loadingMoreInput, false);
	const selectable = normalizeBoolean(selectableInput, true);
	const responsiveBreakpoint = normalizeNumber(responsiveBreakpointInput, 768);
	const totalCount = normalizeNumber(totalCountInput, 0);
	const initialViewMode = normalizeViewMode(viewMode);
	const [selectedRows, setSelectedRows] = useState<RowId[]>([]);
	const [selectionMode, setSelectionMode] = useState(false);
	const [currentViewMode, setCurrentViewMode] =
		useState<ViewMode>(initialViewMode);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const parentRef = useRef<HTMLDivElement | null>(null);
	const tableRef = useRef<HTMLDivElement | null>(null);
	const rowsRef = useRef<HTMLDivElement | null>(null);
	const loadMoreLockRef = useRef<number | null>(null);
	const autoFillRoundsRef = useRef(0);
	const initKeyRef = useRef<string | null>(null);
	const EffectiveCardComponent = (CardComponent ??
		DefaultRowCard) as ComponentType<RowCardProps<TData>>;

	const visibleColumns = useMemo(
		() =>
			columns.filter((column) => currentViewMode === "table" || column.primary),
		[columns, currentViewMode],
	);

	const tableColumnsState = useUnit($tableColumnsState);
	const columnWidths = tableColumnsState.columnWidths[tableId] || [];

	const fallbackColumnWidths = useMemo(() => {
		if (visibleColumns.length === 0) return [];
		return resolveFallbackColumnWidths(visibleColumns);
	}, [visibleColumns]);

	const resolvedColumnWidths = useMemo(() => {
		if (
			columnWidths.length === visibleColumns.length &&
			columnWidths.length > 0
		) {
			return columnWidths;
		}

		return fallbackColumnWidths;
	}, [columnWidths, fallbackColumnWidths, visibleColumns.length]);

	useEffect(() => {
		if (visibleColumns.length === 0 || !tableRef.current) return;

		const initKey = `${tableId}:${visibleColumns
			.map((column) => column.id)
			.join("|")}:${selectable ? "1" : "0"}`;
		const shouldInit =
			columnWidths.length === 0 ||
			columnWidths.length !== visibleColumns.length ||
			initKeyRef.current !== initKey;

		if (!shouldInit) return;

		const containerWidth =
			parentRef.current?.clientWidth ??
			tableRef.current.parentElement?.clientWidth ??
			1000;
		const availableWidth = Math.max(containerWidth - (selectable ? 48 : 0), 0);

		setColumnWidths({
			tableId,
			widths: resolveInitialColumnWidths(visibleColumns, availableWidth),
		});
		initKeyRef.current = initKey;
	}, [tableId, visibleColumns, columnWidths.length, selectable]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const shouldUseCards = entry.contentRect.width < responsiveBreakpoint;
				setCurrentViewMode(shouldUseCards ? "cards" : "table");
			}
		});

		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
	}, [responsiveBreakpoint]);

	const rowSize = currentViewMode === "table" ? 53 : 140;
	const rowCount = hasMore ? data.length + 1 : data.length;
	const rowVirtualizer = useVirtualRows({
		count: rowCount,
		rowSize,
		containerRef: rowsRef,
	});
	const { remainingBelowViewport } = rowVirtualizer;

	const maybeLoadMore = useCallback(
		(fromScroll: boolean) => {
			if (!onLoadMore) return;
			if (loading || loadingMore || !hasMore) return;

			const remaining = remainingBelowViewport();
			// no measurable viewport (hidden tab, zero-height host) — never prefetch blindly
			if (remaining === null) return;
			if (remaining > LOAD_MORE_THRESHOLD) return;
			if (loadMoreLockRef.current === data.length) return;

			if (fromScroll) {
				autoFillRoundsRef.current = 0;
			} else if (autoFillRoundsRef.current >= MAX_AUTO_FILL_ROUNDS) {
				return;
			} else {
				autoFillRoundsRef.current += 1;
			}

			loadMoreLockRef.current = data.length;
			onLoadMore();
		},
		[data.length, hasMore, loading, loadingMore, onLoadMore, remainingBelowViewport],
	);

	useEffect(() => {
		const handleScroll = () => {
			maybeLoadMore(true);
		};

		// the scrollbar may belong to any ancestor, so listen in capture phase
		window.addEventListener("scroll", handleScroll, {
			passive: true,
			capture: true,
		});
		return () =>
			window.removeEventListener("scroll", handleScroll, { capture: true });
	}, [maybeLoadMore]);

	useEffect(() => {
		if (loadMoreLockRef.current === data.length) {
			loadMoreLockRef.current = null;
		}

		maybeLoadMore(false);
	}, [data.length, maybeLoadMore]);

	const sortConfig =
		sortConfigInput &&
		typeof sortConfigInput === "object" &&
		"key" in sortConfigInput
			? (sortConfigInput as SortConfig)
			: null;

	const handleHeaderSortClick = useCallback(
		(columnId: string) => {
			if (!onSort) return;
			const direction =
				sortConfig?.key === columnId && sortConfig?.direction === "asc"
					? "desc"
					: "asc";
			(onSort as (id: string, dir: SortConfig["direction"]) => void)(
				columnId,
				direction,
			);
		},
		[onSort, sortConfig],
	);

	const handleColumnResize = useCallback(
		(columnIndex: number, nextWidth: number) => {
			const column = visibleColumns[columnIndex];
			const minWidth = column?.minWidth ?? 50;
			const maxWidth = column?.maxWidth ?? Number.POSITIVE_INFINITY;
			const width = Math.min(Math.max(nextWidth, minWidth), maxWidth);
			setColumnWidthAtIndex({ tableId, index: columnIndex, width });
		},
		[visibleColumns, tableId],
	);

	const handleSelectAll = useCallback(
		(checked: boolean) => {
			const nextSelection = checked
				? data.map((row, index) => getRowId(row, index))
				: [];

			setSelectedRows(nextSelection);
			onSelectionChange?.(nextSelection, checked ? data : []);
		},
		[data, onSelectionChange],
	);

	const handleSelectRow = useCallback(
		(rowId: RowId, checked: boolean) => {
			const nextSelection = checked
				? [...selectedRows, rowId]
				: selectedRows.filter((id) => id !== rowId);

			setSelectedRows(nextSelection);
			const selectedData = data.filter((row, index) =>
				hasRowId(nextSelection, row, index),
			);
			onSelectionChange?.(nextSelection, selectedData);
		},
		[selectedRows, data, onSelectionChange],
	);

	const handleBulkActionClick = useCallback(
		(actionId: string, selectedIds: RowId[]) => {
			const selectedData = data.filter((row, index) =>
				hasRowId(selectedIds, row, index),
			);
			onBulkAction?.(actionId, selectedData, selectedIds);
			setSelectedRows([]);
		},
		[onBulkAction, data],
	);

	const clearSelection = useCallback(() => {
		setSelectedRows([]);
		onSelectionChange?.([], []);
	}, [onSelectionChange]);

	const isAllSelected = selectedRows.length === data.length && data.length > 0;
	const isIndeterminate =
		selectedRows.length > 0 && selectedRows.length < data.length;

	const renderCards = () => {
		const virtualItems = rowVirtualizer.virtualItems;

		return (
			<div ref={parentRef} class="h-full min-h-0 flex-1 overflow-auto">
				<div
					ref={rowsRef}
					style={{
						height: `${rowVirtualizer.totalSize}px`,
						width: "100%",
						position: "relative",
					}}
				>
					{virtualItems.map((virtualRow) => {
						const isLoaderRow = virtualRow.index > data.length - 1;
						const row = data[virtualRow.index];

						if (isLoaderRow) {
							return hasMore ? (
								<div
									key="loader"
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										height: `${virtualRow.size}px`,
										transform: `translateY(${virtualRow.start}px)`,
									}}
									class="flex items-center justify-center p-4"
								>
									{loadingMore && (
										<p class="text-sm text-muted-foreground">Загрузка...</p>
									)}
								</div>
							) : null;
						}

						if (!row) return null;

						const rowId = getRowId(row, virtualRow.index);
						const isSelected = selectedRows.includes(rowId);

						return (
							<div
								key={rowId}
								data-index={virtualRow.index}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									height: `${virtualRow.size}px`,
									transform: `translateY(${virtualRow.start}px)`,
								}}
								onClick={onRowClick ? () => onRowClick(row) : undefined}
							>
								<div
									class={cn(
										"relative p-2",
										isSelected && "ring-2 ring-primary",
									)}
								>
									<EffectiveCardComponent
										data={row}
										columns={columns}
										onAction={onRowAction}
									/>
									{selectable && selectionMode && (
										<div class="absolute bottom-4 left-4 z-10">
											<input
												type="checkbox"
												checked={isSelected}
												onClick={(event) => event.stopPropagation()}
												onChange={(event) =>
													handleSelectRow(rowId, event.currentTarget.checked)
												}
												class="h-4 w-4 rounded border-input bg-background"
											/>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	const renderTable = () => {
		const virtualItems = rowVirtualizer.virtualItems;

		return (
			<div
				ref={parentRef}
				class={cn(
					"h-full min-h-0 flex-1 overflow-auto bg-background",
					tableClassName,
				)}
			>
				<div ref={tableRef} class="w-full">
					<div class="sticky top-0 z-10 flex h-10 border-b bg-background/90">
						{selectable && selectionMode && (
							<div
								class="flex items-center pl-2 font-medium text-muted-foreground"
								style={{ width: "48px", flexShrink: 0 }}
							>
								<input
									type="checkbox"
									checked={isAllSelected}
									ref={(input) => {
										if (input) input.indeterminate = isIndeterminate;
									}}
									onChange={(event) => handleSelectAll(event.currentTarget.checked)}
									class="h-4 w-4 rounded border-input bg-background"
								/>
							</div>
						)}

						{visibleColumns.map((column, index) => {
							const width = resolvedColumnWidths[index] ?? 150;
							const isSortable = column.sortable === true && Boolean(onSort);
							const isSorted = sortConfig?.key === column.id;
							const SortIcon = !isSorted
								? ArrowUpDown
								: sortConfig?.direction === "asc"
									? ArrowUp
									: ArrowDown;
							return (
								<div
									key={column.id}
									class={cn(
										"relative flex items-center px-2 text-sm font-medium text-muted-foreground",
										isSortable &&
											"cursor-pointer select-none transition-colors hover:text-foreground",
										isSorted && "text-foreground",
									)}
									style={{ width: `${width}px`, flexShrink: 0 }}
									role={isSortable ? "button" : undefined}
									tabIndex={isSortable ? 0 : undefined}
									onClick={
										isSortable
											? () => handleHeaderSortClick(column.id)
											: undefined
									}
									onKeyDown={
										isSortable
											? (event) => {
													if (event.key === "Enter" || event.key === " ") {
														event.preventDefault();
														handleHeaderSortClick(column.id);
													}
												}
											: undefined
									}
								>
									<span class="block truncate overflow-hidden text-ellipsis whitespace-nowrap">
										{column.title}
									</span>
									{isSortable && (
										<SortIcon
											class={cn(
												"ml-1 h-3.5 w-3.5 shrink-0",
												!isSorted && "opacity-40",
											)}
										/>
									)}

									{column.resizable !== false &&
										currentViewMode === "table" && (
											<ColumnResizer
												columnIndex={index}
												currentWidth={width}
												onResize={handleColumnResize}
											/>
										)}
								</div>
							);
						})}
					</div>

					<div
						ref={rowsRef}
						style={{
							position: "relative",
							height: `${rowVirtualizer.totalSize}px`,
						}}
					>
						{virtualItems.map((virtualRow) => {
							const isLoaderRow = virtualRow.index > data.length - 1;
							const row = data[virtualRow.index];

							if (isLoaderRow) {
								return hasMore ? (
									<div
										key="loader"
										class="flex items-center justify-center p-4"
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											width: "100%",
											height: `${virtualRow.size}px`,
											transform: `translateY(${virtualRow.start}px)`,
										}}
									>
										{loadingMore && (
											<p class="text-sm text-muted-foreground">
												Загрузка...
											</p>
										)}
									</div>
								) : null;
							}

							if (!row) return null;

							const rowId = getRowId(row, virtualRow.index);
							const isSelected = selectedRows.includes(rowId);

							return (
								<div
									key={rowId}
									data-index={virtualRow.index}
									class={cn(
										"flex cursor-pointer border-b transition-colors hover:bg-muted/50",
										isSelected && "bg-muted",
									)}
									onClick={onRowClick ? () => onRowClick(row) : undefined}
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										height: `${virtualRow.size}px`,
										transform: `translateY(${virtualRow.start}px)`,
									}}
								>
									{selectable && selectionMode && (
										<div
											class="flex items-center py-3 pl-2"
											style={{ width: "48px", flexShrink: 0 }}
										>
											<input
												type="checkbox"
												checked={isSelected}
												onClick={(event) => event.stopPropagation()}
												onChange={(event) =>
													handleSelectRow(rowId, event.currentTarget.checked)
												}
												class="h-4 w-4 rounded border-input bg-background"
											/>
										</div>
									)}

									{visibleColumns.map((column, index) => {
										const width = resolvedColumnWidths[index] ?? 150;
										return (
											<div
												key={column.id}
												class="flex items-center overflow-hidden px-2 py-3"
												style={{ width: `${width}px`, flexShrink: 0 }}
											>
												<div class="w-full overflow-hidden text-ellipsis whitespace-nowrap">
													<CellRenderer
														value={getRowValue(row, column.id)}
														column={column}
														rowData={row}
														onAction={onRowAction}
													/>
												</div>
											</div>
										);
									})}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div
			ref={containerRef}
			class={cn(
				"relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background",
				className,
			)}
		>
			{selectedRows.length > 0 && (
				<div class="flex flex-shrink-0 items-center justify-between border-b bg-muted px-6 py-3">
					<span class="text-sm font-medium">
						Выбрано: {selectedRows.length} из {data.length}
					</span>
					<div class="flex items-center gap-3">
						<button
							type="button"
							onClick={clearSelection}
							class="text-sm font-medium text-primary hover:text-primary/80"
						>
							Снять выделение
						</button>
						{bulkActions.length > 0 && (
							<ShadDropdown>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										class="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
									>
										Операции
										<MenuIcon size={14} />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{bulkActions.map((action) => (
										<DropdownMenuItem
											key={action.id}
											onClick={() =>
												handleBulkActionClick(action.id, selectedRows)
											}
											class={cn(
												action.variant === "destructive" &&
													"text-destructive focus:text-destructive",
											)}
										>
											{action.icon && (
												<action.icon size={14} class="mr-2" />
											)}
											{action.label}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</ShadDropdown>
						)}
					</div>
				</div>
			)}

			{data.length > 0 && (
				<div class="flex shrink-0 items-center justify-between border-b bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
					{selectable ? (
						<button
							type="button"
							onClick={() => {
								setSelectionMode((value) => !value);
								if (selectionMode) clearSelection();
							}}
							class={cn(
								"flex items-center gap-1.5 transition-colors hover:text-foreground",
								selectionMode && "text-primary",
							)}
						>
							{selectionMode ? <CheckSquare size={13} /> : <Square size={13} />}
							Выбрать
						</button>
					) : (
						<span />
					)}
					<span>
						{(() => {
							const visibleItems = rowVirtualizer.virtualItems.filter(
								(item) => item.index < data.length,
							);
							const lastVisible = visibleItems[visibleItems.length - 1];
							const position = lastVisible
								? lastVisible.index + 1
								: data.length;
							const total = totalCount > 0 ? totalCount : data.length;
							return `${position} / ${total}`;
						})()}
					</span>
				</div>
			)}

			{loading && data.length === 0 ? (
				<div class="flex h-24 w-full items-center justify-center">
					<p class="text-muted-foreground">Загрузка...</p>
				</div>
			) : data.length === 0 ? (
				<div class="flex h-24 w-full items-center justify-center">
					<p class="text-muted-foreground">{emptyMessage}</p>
				</div>
			) : currentViewMode === "table" ? (
				renderTable()
			) : (
				renderCards()
			)}
		</div>
	);
}
