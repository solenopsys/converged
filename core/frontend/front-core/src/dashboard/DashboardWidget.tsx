import * as React from "preact/compat";
import { cn } from "../lib/utils";

interface DashboardWidgetProps {
	children: React.ReactNode;
	className?: string;
}

export function DashboardWidget({ children, className }: DashboardWidgetProps) {
	return (
		<div
			data-slot="dashboard-widget"
			className={cn("h-full w-full", "flex flex-col", "min-h-0 min-w-0", "overflow-hidden", className)}
		>
			<div className="flex-1 min-h-0 min-w-0 flex flex-col [&>*]:flex-1 [&>*]:min-h-0 [&>*]:h-full">
				{children}
			</div>
		</div>
	);
}

export function useWidgetSize(ref: React.RefObject<HTMLElement>) {
	const [size, setSize] = React.useState({ width: 0, height: 0 });

	React.useEffect(() => {
		if (!ref.current) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
			}
		});

		observer.observe(ref.current);
		return () => observer.disconnect();
	}, [ref]);

	return size;
}
