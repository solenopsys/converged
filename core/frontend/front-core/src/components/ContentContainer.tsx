import type { ComponentChildren } from "preact";
import { cn } from "../lib/utils";

/**
 * Centres a screen on a readable measure instead of letting it run edge to edge.
 *
 * The shell gives every surface the whole viewport on purpose: tables and lists
 * are built for it. Screens that read better narrower — a dashboard or a form —
 * opt in here rather than the shell constraining everything.
 */
export function ContentContainer({
	children,
	size = "wide",
	className,
}: {
	children?: ComponentChildren;
	size?: "form" | "wide";
	className?: string;
}) {
	return (
		<div
			className={cn(
				"mx-auto w-full",
				size === "form" ? "max-w-4xl" : "max-w-6xl",
				className,
			)}
		>
			{children}
		</div>
	);
}
