import * as React from "preact/compat";
import * as toggleGroup from "@zag-js/toggle-group";
import { normalizeProps, useMachine } from "@zag-js/preact";
import type { VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";
import { toggleVariants } from "./toggle";

const ToggleGroupStyleContext = React.createContext<VariantProps<typeof toggleVariants>>({
	size: "default",
	variant: "default",
});
const ToggleGroupApiContext = React.createContext<toggleGroup.Api | null>(null);

function ToggleGroup({
	className,
	variant,
	size,
	children,
	type = "single",
	value,
	defaultValue,
	onValueChange,
	disabled,
	...rest
}: {
	className?: string;
	children?: React.ReactNode;
	type?: "single" | "multiple";
	value?: string | string[];
	defaultValue?: string | string[];
	onValueChange?: (value: any) => void;
	disabled?: boolean;
} & VariantProps<typeof toggleVariants> &
	Record<string, unknown>) {
	const single = type === "single";
	const toArray = (v: string | string[] | undefined) => (v == null ? undefined : Array.isArray(v) ? v : [v]);

	const service = useMachine(toggleGroup.machine, {
		id: React.useId(),
		disabled,
		value: toArray(value),
		defaultValue: toArray(defaultValue),
		onValueChange: (details) => {
			onValueChange?.(single ? details.value[0] : details.value);
		},
	});
	const api = toggleGroup.connect(service, normalizeProps);

	return (
		<ToggleGroupApiContext.Provider value={api}>
			<div
				data-slot="toggle-group"
				data-variant={variant}
				data-size={size}
				className={cn(
					"group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs",
					className,
				)}
				{...api.getRootProps()}
				{...(rest as any)}
			>
				<ToggleGroupStyleContext.Provider value={{ variant, size }}>{children}</ToggleGroupStyleContext.Provider>
			</div>
		</ToggleGroupApiContext.Provider>
	);
}

function ToggleGroupItem({
	className,
	children,
	variant,
	size,
	value,
	disabled,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof toggleVariants> & { value: string }) {
	const context = React.useContext(ToggleGroupStyleContext);
	const api = React.useContext(ToggleGroupApiContext);
	if (!api) throw new Error("ToggleGroupItem must be used within <ToggleGroup>");

	return (
		<button
			data-slot="toggle-group-item"
			data-variant={context.variant || variant}
			data-size={context.size || size}
			className={cn(
				toggleVariants({ variant: context.variant || variant, size: context.size || size }),
				"min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
				className,
			)}
			{...api.getItemProps({ value, disabled })}
			{...props}
		>
			{children}
		</button>
	);
}

export { ToggleGroup, ToggleGroupItem };
