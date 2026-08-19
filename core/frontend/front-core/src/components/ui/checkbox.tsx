import * as React from "preact/compat";
import * as checkbox from "@zag-js/checkbox";
import { normalizeProps, useMachine } from "@zag-js/preact";
import { CheckIcon } from "../../icons";

import { cn } from "../../lib/utils";

function Checkbox({
	className,
	id,
	checked,
	defaultChecked,
	onCheckedChange,
	disabled,
	"aria-label": ariaLabel,
	...rest
}: {
	className?: string;
	id?: string;
	checked?: boolean | "indeterminate";
	defaultChecked?: boolean | "indeterminate";
	onCheckedChange?: (checked: boolean | "indeterminate") => void;
	disabled?: boolean;
	"aria-label"?: string;
} & Record<string, unknown>) {
	const service = useMachine(checkbox.machine, {
		id: React.useId(),
		ids: id ? { hiddenInput: id } : undefined,
		checked,
		defaultChecked,
		disabled,
		onCheckedChange: (details) => onCheckedChange?.(details.checked),
	});
	const api = checkbox.connect(service, normalizeProps);

	return (
		<label
			data-slot="checkbox"
			aria-label={ariaLabel}
			className={cn(
				"peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none disabled:cursor-not-allowed disabled:opacity-50 inline-flex",
				className,
			)}
			{...api.getRootProps()}
			{...(rest as any)}
		>
			<input {...api.getHiddenInputProps()} />
			<div
				data-slot="checkbox-indicator"
				className="flex items-center justify-center text-current transition-none size-full"
				{...api.getControlProps()}
			>
				{(api.checked || api.indeterminate) && <CheckIcon className="size-3.5" />}
			</div>
		</label>
	);
}

export { Checkbox };
