import type { ComponentChildren } from "preact";
import type { StreamlineIcon } from "../icons";
import { cn } from "../lib/utils";
import { ContentContainer } from "./ContentContainer";
import { Button, type buttonVariants } from "./ui/button";

export type FormCommand = {
	id: string;
	label: string;
	icon?: StreamlineIcon;
	onSelect: () => void | Promise<void>;
	disabled?: boolean;
	variant?: NonNullable<Parameters<typeof buttonVariants>[0]>["variant"];
	type?: "button" | "submit";
};

/** A single rendering path for commands at the bottom of every form. */
export function FormCommandList({
	commands,
}: {
	commands: readonly FormCommand[];
}) {
	return (
		<div className="flex flex-wrap justify-end gap-3">
			{commands.map((command) => {
				const Icon = command.icon;
				return (
					<Button
						key={command.id}
						type={command.type ?? "button"}
						variant={command.variant}
						disabled={command.disabled}
						onClick={() => void command.onSelect()}
					>
						{Icon && <Icon />}
						{command.label}
					</Button>
				);
			})}
		</div>
	);
}

/**
 * Shared frame for record and workflow forms.
 *
 * The shell owns the viewport height; this component reserves a single
 * scrollable body and keeps the optional footer visible. Form implementations
 * only supply their fields and domain-specific actions.
 */
export function FormLayout({
	children,
	header,
	footer,
	commands,
	size = "form",
	className,
	bodyClassName,
	headerClassName,
	footerClassName,
}: {
	children: ComponentChildren;
	header?: ComponentChildren;
	footer?: ComponentChildren;
	commands?: readonly FormCommand[];
	size?: "form" | "wide";
	className?: string;
	bodyClassName?: string;
	headerClassName?: string;
	footerClassName?: string;
}) {
	return (
		<ContentContainer
			size={size}
			className={cn("flex h-full min-h-0 flex-col", className)}
		>
			{header && (
				<div className={cn("shrink-0 border-b px-6 py-4", headerClassName)}>
					{header}
				</div>
			)}
			<div
				className={cn(
					"min-h-0 flex-1 overflow-y-auto px-6 py-4",
					bodyClassName,
				)}
			>
				{children}
			</div>
			{(footer || commands?.length) && (
				<footer
					className={cn(
						"flex shrink-0 justify-end border-t px-6 py-4",
						footerClassName,
					)}
				>
					{commands?.length ? <FormCommandList commands={commands} /> : footer}
				</footer>
			)}
		</ContentContainer>
	);
}
