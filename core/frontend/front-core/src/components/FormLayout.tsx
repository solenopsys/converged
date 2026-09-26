import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/compat";
import { Check, type StreamlineIcon, X } from "../icons";
import { cn } from "../lib/utils";
import { ContentContainer } from "./ContentContainer";
import { Button, type buttonVariants } from "./ui/button";

export type FormCommand = {
	id: string;
	label: string;
	icon?: StreamlineIcon;
	onSelect: () => unknown;
	disabled?: boolean;
	variant?: NonNullable<Parameters<typeof buttonVariants>[0]>["variant"];
	type?: "button" | "submit";
	className?: string;
	successLabel?: string;
	errorLabel?: string;
};

function FormCommandButton({ command }: { command: FormCommand }) {
	const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
	const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isSave = command.id === "save";

	useEffect(
		() => () => {
			if (successTimeout.current) clearTimeout(successTimeout.current);
		},
		[],
	);

	const handleSelect = async () => {
		if (successTimeout.current) {
			clearTimeout(successTimeout.current);
			successTimeout.current = null;
		}
		setStatus("idle");
		try {
			const result = await command.onSelect();
			if (isSave) {
				setStatus(result === false ? "error" : "success");
				successTimeout.current = setTimeout(() => {
					setStatus("idle");
					successTimeout.current = null;
				}, 1800);
			}
		} catch (error) {
			console.error(`Form command ${command.id} failed:`, error);
			if (isSave) {
				setStatus("error");
				successTimeout.current = setTimeout(() => {
					setStatus("idle");
					successTimeout.current = null;
				}, 1800);
			}
		}
	};

	const Icon =
		status === "success" ? Check : status === "error" ? X : command.icon;
	return (
		<Button
			type={command.type ?? "button"}
			variant={command.variant}
			className={cn(
				"transition-colors duration-700 ease-out motion-reduce:transition-none",
				command.className,
				status === "success" &&
					"border-success bg-success text-success-foreground hover:bg-success/90",
				status === "error" &&
					"border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
			)}
			aria-live={isSave ? "polite" : undefined}
			aria-label={
				status === "success"
					? (command.successLabel ?? "Saved")
					: status === "error"
						? (command.errorLabel ?? "Save failed")
						: undefined
			}
			disabled={command.disabled}
			onClick={() => void handleSelect()}
		>
			{Icon && <Icon />}
			{status === "success"
				? (command.successLabel ?? "Saved")
				: status === "error"
					? (command.errorLabel ?? "Save failed")
					: command.label}
		</Button>
	);
}

/** A single rendering path for commands at the bottom of every form. */
export function FormCommandList({
	commands,
}: {
	commands: readonly FormCommand[];
}) {
	return (
		<div className="flex flex-wrap justify-end gap-3">
			{commands.map((command) => {
				return <FormCommandButton key={command.id} command={command} />;
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
