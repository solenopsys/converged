import * as popover from "@zag-js/popover";
import { normalizeProps, Portal, useMachine } from "@zag-js/preact";
import { useId } from "preact/hooks";
import { cn } from "../../lib/utils";
import { FilterCell } from "./FilterCell";
import type { TableFilterConfig, TableFilterValues } from "./types";

export function isFilterActive(value: unknown): boolean {
	if (typeof value === "string") return value.trim().length > 0;
	if (Array.isArray(value))
		return value.some((item) => String(item).length > 0);
	return value !== undefined && value !== null && value !== false;
}

export function ColumnFilterControl({
	filter,
	values,
	onChange,
}: {
	filter: TableFilterConfig;
	values: TableFilterValues;
	onChange: (values: TableFilterValues) => void;
}) {
	const service = useMachine(popover.machine, {
		id: useId(),
		portalled: true,
		closeOnInteractOutside: true,
		closeOnEscape: true,
		onInteractOutside: (event) => {
			event.preventDefault();
			setOpen(false);
		},
		positioning: { placement: "bottom-start", gutter: 4 },
	});
	const api = popover.connect(service, normalizeProps);
	function setOpen(open: boolean) {
		api.setOpen(open);
	}
	const active = isFilterActive(values[filter.id]);

	return (
		<div
			className="relative flex items-center"
			onClick={(event) => event.stopPropagation()}
		>
			<button
				{...api.getTriggerProps()}
				type="button"
				aria-label={`${filter.label ?? filter.id} filter`}
				title={filter.label ?? filter.id}
				className={cn(
					"inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
					(active || api.open) && "text-primary !opacity-100",
				)}
			>
				<svg
					aria-hidden="true"
					viewBox="0 0 16 16"
					className="size-3.5"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M2 3h12l-4.6 5.1v4.1l-2.8 1.5V8.1L2 3Z" />
				</svg>
			</button>
			{api.open && (
				<Portal>
					<div {...api.getPositionerProps()}>
						<div
							{...api.getContentProps()}
							className="z-50 w-60 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
						>
							<div
								{...api.getTitleProps()}
								className="mb-2 text-xs font-medium text-muted-foreground"
							>
								{filter.label ?? filter.id}
							</div>
							<FilterCell
								filter={filter}
								value={values[filter.id]}
								onEnter={() => api.setOpen(false)}
								onValueChange={(value) => {
									const next = { ...values };
									if (
										value === "" ||
										(Array.isArray(value) && value.length === 0)
									) {
										delete next[filter.id];
									} else {
										next[filter.id] = value;
									}
									onChange(next);
									if (
										filter.type === "select" ||
										filter.type === "multi-select"
									) {
										api.setOpen(false);
									}
								}}
							/>
							{active && (
								<button
									type="button"
									className="mt-2 w-full border-t pt-2 text-left text-xs text-muted-foreground hover:text-foreground"
									onClick={() => {
										const next = { ...values };
										delete next[filter.id];
										onChange(next);
										api.setOpen(false);
									}}
								>
									Clear filter
								</button>
							)}
						</div>
					</div>
				</Portal>
			)}
		</div>
	);
}
