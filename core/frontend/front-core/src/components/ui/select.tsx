import * as React from "preact/compat";
import { CheckIcon, ChevronDownIcon } from "../../icons";

import { cn } from "../../lib/utils";

// Rough replacement for @radix-ui/react-select: children declare items
// declaratively (SelectItem), so instead of wiring zag's upfront
// collection-based select machine, this is a small self-contained
// open/value/onValueChange context + a positioned popover.

interface SelectContextValue {
	value?: string;
	setValue: (value: string) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	labelByValue: React.MutableRefObject<Map<string, React.ReactNode>>;
}
const SelectContext = React.createContext<SelectContextValue | null>(null);

function Select({
	children,
	value,
	defaultValue,
	onValueChange,
}: {
	children?: React.ReactNode;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
}) {
	const [open, setOpen] = React.useState(false);
	const [internalValue, setInternalValue] = React.useState(defaultValue);
	const isControlled = value !== undefined;
	const currentValue = isControlled ? value : internalValue;
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const labelByValue = React.useRef(new Map<string, React.ReactNode>());

	const setValue = (v: string) => {
		if (!isControlled) setInternalValue(v);
		onValueChange?.(v);
		setOpen(false);
	};

	return (
		<SelectContext.Provider value={{ value: currentValue, setValue, open, setOpen, triggerRef, labelByValue }}>
			<div data-slot="select" className="relative inline-block">
				{children}
			</div>
		</SelectContext.Provider>
	);
}

function useSelect() {
	const ctx = React.useContext(SelectContext);
	if (!ctx) throw new Error("Select.* must be used within <Select>");
	return ctx;
}

function SelectGroup({ ...props }: React.ComponentProps<"div">) {
	return <div data-slot="select-group" role="group" {...props} />;
}

function SelectValue({
	placeholder,
	...props
}: React.ComponentProps<"span"> & { placeholder?: React.ReactNode }) {
	const { value, labelByValue } = useSelect();
	const label = value ? (labelByValue.current.get(value) ?? value) : undefined;
	return (
		<span data-slot="select-value" {...props}>
			{label ?? placeholder}
		</span>
	);
}

function SelectTrigger({
	className,
	size = "default",
	children,
	...props
}: React.ComponentProps<"button"> & { size?: "sm" | "default" }) {
	const { open, setOpen, triggerRef } = useSelect();
	return (
		<button
			type="button"
			ref={triggerRef}
			data-slot="select-trigger"
			data-size={size}
			aria-expanded={open}
			className={cn(
				"border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			onClick={() => setOpen(!open)}
			{...props}
		>
			{children}
			<ChevronDownIcon className="size-4 opacity-50" />
		</button>
	);
}

function SelectContent({ className, children, ...props }: React.ComponentProps<"div">) {
	const { open, setOpen } = useSelect();
	const ref = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (!open) return;
		const onDocClick = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDocClick);
		return () => document.removeEventListener("mousedown", onDocClick);
	}, [open, setOpen]);

	if (!open) return null;
	return (
		<div
			ref={ref}
			data-slot="select-content"
			className={cn(
				"bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border shadow-md p-1",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="select-label" className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)} {...props} />
	);
}

function SelectItem({
	className,
	children,
	value,
	disabled,
	...props
}: React.ComponentProps<"div"> & { value: string; disabled?: boolean }) {
	const { value: selected, setValue, labelByValue } = useSelect();
	labelByValue.current.set(value, children);
	const isSelected = selected === value;

	return (
		<div
			data-slot="select-item"
			data-disabled={disabled ? "" : undefined}
			role="option"
			aria-selected={isSelected}
			className={cn(
				"focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			onClick={() => !disabled && setValue(value)}
			{...props}
		>
			<span className="absolute right-2 flex size-3.5 items-center justify-center">
				{isSelected && <CheckIcon className="size-4" />}
			</span>
			<span data-slot="select-item-text">{children}</span>
		</div>
	);
}

function SelectSeparator({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="select-separator" className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)} {...props} />;
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="select-scroll-up-button" className={className} {...props} />;
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="select-scroll-down-button" className={className} {...props} />;
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
