import { normalizeProps, Portal, useMachine } from "@zag-js/preact";
import * as select from "@zag-js/select";
import { useEffect, useId, useMemo, useState } from "preact/hooks";
import { CheckIcon, ChevronDown } from "../../icons";
import { cn } from "../../lib/utils";
import type { TableFilterConfig, TableFilterOption } from "./types";

type ZagSelectFilterProps = {
	filter: TableFilterConfig;
	value: string[];
	multiple?: boolean;
	onValueChange: (value: string[]) => void;
};

export function ZagSelectFilter({
	filter,
	value,
	multiple = false,
	onValueChange,
}: ZagSelectFilterProps) {
	const [loadedOptions, setLoadedOptions] = useState<
		readonly TableFilterOption[]
	>(filter.options ?? []);

	useEffect(() => {
		let cancelled = false;
		if (!filter.loadOptions) {
			setLoadedOptions(filter.options ?? []);
			return () => {
				cancelled = true;
			};
		}
		void filter
			.loadOptions()
			.then((options) => {
				if (!cancelled) setLoadedOptions(options);
			})
			.catch(() => {
				if (!cancelled) setLoadedOptions([]);
			});
		return () => {
			cancelled = true;
		};
	}, [filter]);

	const options = loadedOptions;
	const collection = useMemo(
		() =>
			select.collection({
				items: options,
				itemToValue: (option: TableFilterOption) => option.value,
				itemToString: (option: TableFilterOption) => option.label,
			}),
		[options],
	);
	const service = useMachine(select.machine, {
		id: useId(),
		collection,
		value,
		multiple,
		closeOnSelect: !multiple,
		positioning: { placement: "bottom-start", gutter: 4 },
		onValueChange: ({ value: next }) => onValueChange(next),
	});
	const api = select.connect(service, normalizeProps);
	const label = value.length
		? multiple
			? `${filter.label ?? filter.id}: ${value.length}`
			: (options.find((option) => option.value === value[0])?.label ?? value[0])
		: (filter.allLabel ?? filter.label ?? "All");

	return (
		<div className="relative w-full" {...api.getRootProps()}>
			<select {...api.getHiddenSelectProps()} />
			<div {...api.getControlProps()} className="w-full">
				<button
					type="button"
					aria-label={filter.label ?? filter.id}
					className="border-input bg-background hover:bg-accent flex h-7 w-full min-w-0 items-center gap-1 rounded-md border px-2 text-left text-xs"
					{...api.getTriggerProps()}
				>
					<span className="min-w-0 flex-1 truncate">{label}</span>
					<ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				</button>
			</div>
			{api.open && (
				<Portal>
					<div {...api.getPositionerProps()}>
						<div
							{...api.getContentProps()}
							className="bg-popover text-popover-foreground z-50 max-h-72 min-w-44 overflow-y-auto rounded-md border p-1 shadow-md"
						>
							<div {...api.getListProps()}>
								{options.map((option) => (
									<div
										key={option.value}
										{...api.getItemProps({ item: option })}
										className="hover:bg-accent relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none"
									>
										<span
											{...api.getItemIndicatorProps({ item: option })}
											className={cn(
												"absolute left-2 flex size-3.5 items-center justify-center",
											)}
										>
											<CheckIcon className="size-3.5" />
										</span>
										<span {...api.getItemTextProps({ item: option })}>
											{option.label}
										</span>
									</div>
								))}
							</div>
							{value.length > 0 && (
								<div className="mt-1 border-t pt-1">
									<button
										type="button"
										className="hover:bg-accent flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm"
										onClick={() => {
											onValueChange([]);
											api.setOpen(false);
										}}
									>
										Reset
									</button>
								</div>
							)}
						</div>
					</div>
				</Portal>
			)}
		</div>
	);
}
