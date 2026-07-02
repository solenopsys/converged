import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { Input } from "../input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";

export type TableFilterOption = {
	value: string;
	label: string;
};

export type TableFilterConfig = {
	/** Param name sent to the list API (spread into the request by the store). */
	id: string;
	type: "search" | "select";
	label?: string;
	placeholder?: string;
	options?: TableFilterOption[];
	/** Label of the "no filter" option for selects. */
	allLabel?: string;
	debounceMs?: number;
	className?: string;
};

export type TableFilterValues = Record<string, unknown>;

const ALL_VALUE = "__all__";

function SearchFilter({
	filter,
	value,
	onValueChange,
}: {
	filter: TableFilterConfig;
	value: string;
	onValueChange: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setDraft(value);
	}, [value]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const commit = (next: string) => {
		setDraft(next);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(
			() => onValueChange(next),
			filter.debounceMs ?? 400,
		);
	};

	return (
		<div className={cn("relative w-56", filter.className)}>
			<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				value={draft}
				onChange={(event) => commit(event.target.value)}
				placeholder={filter.placeholder ?? filter.label ?? "Search"}
				className="h-8 pl-8 pr-7"
			/>
			{draft && (
				<button
					type="button"
					aria-label="Clear"
					className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
					onClick={() => {
						setDraft("");
						if (timerRef.current) clearTimeout(timerRef.current);
						onValueChange("");
					}}
				>
					<X className="h-3.5 w-3.5" />
				</button>
			)}
		</div>
	);
}

/**
 * Declarative filter toolbar for list views. Emits a clean params map
 * (empty values removed) which is passed straight to the table store's
 * setFilters and from there to the list API.
 */
export function TableFilterBar({
	filters,
	values,
	onChange,
	className,
}: {
	filters: TableFilterConfig[];
	values: TableFilterValues;
	onChange: (values: TableFilterValues) => void;
	className?: string;
}) {
	const setValue = (id: string, value: string) => {
		const next: TableFilterValues = { ...values };
		if (value === "" || value === ALL_VALUE) {
			delete next[id];
		} else {
			next[id] = value;
		}
		onChange(next);
	};

	if (filters.length === 0) return null;

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			{filters.map((filter) => {
				if (filter.type === "search") {
					return (
						<SearchFilter
							key={filter.id}
							filter={filter}
							value={String(values[filter.id] ?? "")}
							onValueChange={(value) => setValue(filter.id, value)}
						/>
					);
				}

				return (
					<Select
						key={filter.id}
						value={String(values[filter.id] ?? ALL_VALUE)}
						onValueChange={(value) => setValue(filter.id, value)}
					>
						<SelectTrigger size="sm" className={cn("w-44", filter.className)}>
							<SelectValue placeholder={filter.label ?? filter.id} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_VALUE}>
								{filter.allLabel ?? filter.label ?? "All"}
							</SelectItem>
							{(filter.options ?? []).map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				);
			})}
		</div>
	);
}
