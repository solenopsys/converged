import { loadObjectType, objectRegistry } from "front-core/object-runtime";
import { useEffect, useMemo, useState } from "preact/hooks";
import { cn } from "../lib/utils";
import type {
	TableFilterConfig,
	TableFilterOption,
} from "../table/filter-header/types";
import { ZagSelectFilter } from "../table/filter-header/ZagSelectFilter";

export type EntityDropBoxProps = {
	objectType: string;
	value: string[];
	onValueChange: (value: string[]) => void;
	multiple?: boolean;
	filter?: Record<string, unknown>;
	placeholder?: string;
	pageSize?: number;
	className?: string;
};

type Page = { items?: unknown[] };

function matchesFilter(
	row: unknown,
	filter: Record<string, unknown> | undefined,
): boolean {
	if (!filter || !row || typeof row !== "object") return true;
	const record = row as Record<string, unknown>;
	return Object.entries(filter).every(([field, clause]) => {
		const value = record[field];
		if (!clause || typeof clause !== "object") return value === clause;
		const operators = clause as Record<string, unknown>;
		if ("eq" in operators) return value === operators.eq;
		if (Array.isArray(operators.in)) return operators.in.includes(value);
		if (typeof operators.contains === "string")
			return String(value ?? "").includes(operators.contains);
		return true;
	});
}

function optionFromRow(
	objectType: string,
	row: unknown,
): TableFilterOption | null {
	if (!row || typeof row !== "object") return null;
	const record = row as Record<string, unknown>;
	const definition = objectRegistry.type(objectType);
	const reference = definition?.infinity?.rowRef?.(record);
	const id =
		reference?.kind === "object"
			? reference.id
			: typeof record[definition?.idField ?? "id"] === "string"
				? String(record[definition?.idField ?? "id"])
				: "";
	if (!id) return null;
	const label =
		reference?.kind === "object" && reference.title
			? reference.title
			: typeof record.name === "string"
				? record.name
				: typeof record.title === "string"
					? record.title
					: id;
	return { value: id, label };
}

/**
 * A form picker backed by an object's existing infinity projection. The object
 * type owns loading, filtering and row identity; forms only declare relations.
 */
export function EntityDropBox({
	objectType,
	value,
	onValueChange,
	multiple = false,
	filter,
	placeholder,
	pageSize = 100,
	className,
}: EntityDropBoxProps) {
	const [options, setOptions] = useState<readonly TableFilterOption[]>([]);
	const [error, setError] = useState<string>();
	const filterKey = JSON.stringify(filter ?? {});

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				await loadObjectType(objectType);
				const infinity = objectRegistry.type(objectType)?.infinity;
				if (!infinity) throw new Error(`Entity ${objectType} has no infinity`);
				const params = { offset: 0, limit: pageSize };
				const page = infinity.load
					? ((await infinity.load(params)) as Page)
					: infinity.store
						? ((await infinity.store.loadDataFx(params)) as Page)
						: undefined;
				if (!page) throw new Error(`Entity ${objectType} has no data source`);
				if (!cancelled) {
					setOptions(
						(page.items ?? [])
							.filter((row) => matchesFilter(row, filter))
							.map((row) => optionFromRow(objectType, row))
							.filter((option): option is TableFilterOption => option !== null),
					);
					setError(undefined);
				}
			} catch (cause) {
				if (!cancelled) {
					setOptions([]);
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [objectType, pageSize, filterKey]);

	const picker = useMemo<TableFilterConfig>(
		() => ({
			id: objectType,
			label:
				placeholder ?? objectRegistry.type(objectType)?.label ?? objectType,
			allLabel: placeholder,
			type: multiple ? "multi-select" : "select",
			options,
		}),
		[objectType, placeholder, multiple, options],
	);

	return (
		<div className={cn("grid gap-1", className)}>
			<ZagSelectFilter
				filter={picker}
				value={value}
				multiple={multiple}
				onValueChange={onValueChange}
			/>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
